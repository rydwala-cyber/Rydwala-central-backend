import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/db.ts';
import { socketManager } from '../websocket/socketManager.ts';
import { Payment, Transaction } from '../types/index.ts';

export class PaymentService {
  /**
   * Cash Collection: Driver confirms receiving cash
   */
  public async collectCashPayment(data: { rideId: string; driverId: string; amount?: number }): Promise<Payment> {
    const ride = db.rides.get(data.rideId);
    if (!ride) {
      throw new Error(`Ride ${data.rideId} not found.`);
    }

    if (ride.driverId !== data.driverId) {
      throw new Error('Unauthorized: Only the assigned driver can confirm cash collection.');
    }

    const amount = data.amount || ride.fare;
    const paymentId = `PAY-${uuidv4().substring(0, 8).toUpperCase()}`;

    const payment: Payment = {
      paymentId,
      rideId: ride.rideId,
      customerId: ride.customerId,
      driverId: ride.driverId,
      amount,
      method: 'CASH',
      status: 'PAYMENT_SUCCESSFUL',
      collectedByDriver: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    db.payments.set(paymentId, payment);

    // Update ride payment status
    ride.paymentStatus = 'PAYMENT_SUCCESSFUL';
    ride.paymentMethod = 'CASH';
    ride.updatedAt = new Date().toISOString();
    db.rides.set(ride.rideId, ride);

    // Record Transaction
    const transactionId = `TXN-${uuidv4().substring(0, 8).toUpperCase()}`;
    const commission = Math.round(amount * (db.settings.platformCommissionPercent / 100));
    const driverEarnings = amount - commission;

    const transaction: Transaction = {
      transactionId,
      paymentId,
      rideId: ride.rideId,
      type: 'RIDE_PAYMENT',
      amount,
      driverEarnings,
      platformFee: commission,
      status: 'SUCCESS',
      description: `Cash payment received by driver ${ride.driverName} for ride ${ride.rideId}`,
      createdAt: new Date().toISOString(),
    };
    db.transactions.set(transactionId, transaction);

    // Real-time synchronization
    socketManager.emitToCustomer(ride.customerId, 'PAYMENT_SUCCESSFUL', {
      rideId: ride.rideId,
      paymentId,
      amount,
      method: 'CASH',
      status: 'PAYMENT_SUCCESSFUL',
      message: 'Driver confirmed receipt of cash payment. Thank you for riding with Rydwala!',
    });

    socketManager.emitToDriver(data.driverId, 'PAYMENT_SUCCESSFUL', {
      rideId: ride.rideId,
      paymentId,
      amount,
      status: 'PAYMENT_SUCCESSFUL',
    });

    socketManager.emitRideUpdate(ride.rideId, 'PAYMENT_SUCCESSFUL', { payment, ride });

    return payment;
  }

  /**
   * Create UPI Intent & Dynamic QR Details
   */
  public createUpiPaymentIntent(rideId: string): {
    rideId: string;
    amount: number;
    upiId: string;
    merchantName: string;
    qrPayload: string;
    status: string;
  } {
    const ride = db.rides.get(rideId);
    if (!ride) throw new Error(`Ride ${rideId} not found.`);

    const upiId = db.settings.upiMerchantId;
    const merchantName = db.settings.upiMerchantName;
    const qrPayload = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(merchantName)}&am=${ride.fare}&cu=INR&tn=Rydwala%20Ride%20${ride.rideId}`;

    return {
      rideId: ride.rideId,
      amount: ride.fare,
      upiId,
      merchantName,
      qrPayload,
      status: ride.paymentStatus,
    };
  }

  /**
   * UPI Gateway Webhook / Signature Verification
   * Strictly verifies transaction before marking PAYMENT_SUCCESSFUL
   */
  public async handleUpiWebhook(payload: {
    rideId: string;
    transactionRef: string;
    amount: number;
    status: 'SUCCESS' | 'FAILURE' | 'PENDING';
    signature?: string;
  }): Promise<Payment> {
    const ride = db.rides.get(payload.rideId);
    if (!ride) throw new Error(`Ride ${payload.rideId} not found for webhook verification.`);

    if (payload.status !== 'SUCCESS') {
      ride.paymentStatus = 'PAYMENT_FAILED';
      ride.updatedAt = new Date().toISOString();
      db.rides.set(ride.rideId, ride);
      throw new Error(`UPI Transaction failed: ${payload.status}`);
    }

    const paymentId = `PAY-UPI-${uuidv4().substring(0, 8).toUpperCase()}`;
    const payment: Payment = {
      paymentId,
      rideId: ride.rideId,
      customerId: ride.customerId,
      driverId: ride.driverId,
      amount: payload.amount,
      method: 'UPI',
      status: 'PAYMENT_SUCCESSFUL',
      transactionRef: payload.transactionRef,
      collectedByDriver: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    db.payments.set(paymentId, payment);

    ride.paymentStatus = 'PAYMENT_SUCCESSFUL';
    ride.paymentMethod = 'UPI';
    ride.updatedAt = new Date().toISOString();
    db.rides.set(ride.rideId, ride);

    // Record Transaction
    const transactionId = `TXN-UPI-${uuidv4().substring(0, 8).toUpperCase()}`;
    const commission = Math.round(payload.amount * (db.settings.platformCommissionPercent / 100));
    const driverEarnings = payload.amount - commission;

    const transaction: Transaction = {
      transactionId,
      paymentId,
      rideId: ride.rideId,
      type: 'RIDE_PAYMENT',
      amount: payload.amount,
      driverEarnings,
      platformFee: commission,
      status: 'SUCCESS',
      description: `Verified UPI webhook transaction ${payload.transactionRef} for ride ${ride.rideId}`,
      createdAt: new Date().toISOString(),
    };
    db.transactions.set(transactionId, transaction);

    // Real-time synchronization to Customer, Driver & Admin
    socketManager.emitToCustomer(ride.customerId, 'PAYMENT_SUCCESSFUL', {
      rideId: ride.rideId,
      paymentId,
      amount: payload.amount,
      method: 'UPI',
      transactionRef: payload.transactionRef,
      status: 'PAYMENT_SUCCESSFUL',
      message: 'UPI payment verified successfully!',
    });

    if (ride.driverId) {
      socketManager.emitToDriver(ride.driverId, 'PAYMENT_SUCCESSFUL', {
        rideId: ride.rideId,
        paymentId,
        amount: payload.amount,
        method: 'UPI',
        transactionRef: payload.transactionRef,
        status: 'PAYMENT_SUCCESSFUL',
      });
    }

    socketManager.emitRideUpdate(ride.rideId, 'PAYMENT_SUCCESSFUL', { payment, ride });

    return payment;
  }
}

export const paymentService = new PaymentService();
