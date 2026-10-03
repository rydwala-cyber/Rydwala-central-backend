import { db } from '../db/db.ts';
import { Customer, CustomerStatus } from '../types/index.ts';

export class CustomerService {
  /**
   * Get customer by ID
   */
  public getCustomerById(customerId: string): Customer {
    const customer = db.customers.get(customerId);
    if (!customer) {
      throw new Error(`Customer with ID ${customerId} not found.`);
    }
    const { passwordHash: _, ...safeCustomer } = customer;
    return safeCustomer as Customer;
  }

  /**
   * Update customer profile
   */
  public updateProfile(customerId: string, data: Partial<Customer>): Customer {
    const customer = db.customers.get(customerId);
    if (!customer) {
      throw new Error(`Customer ${customerId} not found.`);
    }

    if (data.name) customer.name = data.name.trim();
    if (data.email) customer.email = data.email.trim();
    customer.updatedAt = new Date().toISOString();

    db.customers.set(customerId, customer);
    const { passwordHash: _, ...safeCustomer } = customer;
    return safeCustomer as Customer;
  }

  /**
   * Get all rides taken by customer
   */
  public getCustomerRides(customerId: string) {
    return Array.from(db.rides.values())
      .filter(r => r.customerId === customerId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  /**
   * Admin: Update Customer Status (ACTIVE / BLOCKED)
   */
  public updateStatus(customerId: string, status: CustomerStatus): Customer {
    const customer = db.customers.get(customerId);
    if (!customer) {
      throw new Error(`Customer ${customerId} not found.`);
    }
    customer.status = status;
    customer.updatedAt = new Date().toISOString();
    db.customers.set(customerId, customer);
    const { passwordHash: _, ...safeCustomer } = customer;
    return safeCustomer as Customer;
  }
}

export const customerService = new CustomerService();
