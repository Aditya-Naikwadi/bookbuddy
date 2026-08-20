import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { PaymentDialog } from '../../components/student/loans-tracker/PaymentDialog';
import * as paymentApi from '../../api/paymentApi';

vi.mock('../../api/paymentApi', () => ({
  createRazorpayOrder: vi.fn(),
  verifyRazorpayPayment: vi.fn(),
}));

vi.mock('../../context/ConfigContext.jsx', () => ({
  useConfig: () => ({ razorpayKeyId: 'rzp_test_mock_key' }),
}));

describe('PaymentDialog Component (Razorpay PCI-DSS Integration)', () => {
  const mockOnClose = vi.fn();
  const mockOnConfirm = vi.fn();
  const sampleFine = {
    _id: 'fine123',
    amount: 150.0,
    overdueDays: 5,
    loanId: { bookId: { title: 'Design Patterns' } },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    window.Razorpay = vi.fn().mockImplementation(function () {
      this.open = vi.fn();
      this.on = vi.fn();
    });
  });

  it('renders fine settlement summary and pay button', () => {
    render(
      <PaymentDialog
        isOpen={true}
        onClose={mockOnClose}
        fineItem={sampleFine}
        totalAmount={150.0}
        onConfirm={mockOnConfirm}
      />
    );

    expect(screen.getByText(/Fine Payment Gateway/i)).toBeInTheDocument();
    expect(screen.getByText(/PCI-DSS Compliant Hosted Gateway/i)).toBeInTheDocument();
    expect(screen.getByText('₹150.00')).toBeInTheDocument();
  });

  it('initiates Razorpay order creation when pay button is clicked', async () => {
    paymentApi.createRazorpayOrder.mockResolvedValue({
      order_id: 'order_mock_123',
      amount: 15000,
      currency: 'INR',
      key_id: 'rzp_test_mock_key',
    });

    render(
      <PaymentDialog
        isOpen={true}
        onClose={mockOnClose}
        fineItem={sampleFine}
        totalAmount={150.0}
        onConfirm={mockOnConfirm}
      />
    );

    const payBtn = screen.getByRole('button', { name: /Pay ₹150.00 Now/i });
    fireEvent.click(payBtn);

    await waitFor(() => {
      expect(paymentApi.createRazorpayOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          fineId: 'fine123',
        })
      );
    });
  });
});
