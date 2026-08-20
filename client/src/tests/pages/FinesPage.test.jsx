import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { Fines } from '../../pages/Fines';

describe('Fines Page & F7.5 Payment Processing Confirmation UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
    window.Razorpay = vi.fn().mockImplementation(function () {
      this.open = vi.fn();
    });
  });

  it('renders outstanding fine items and total balance', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: [
          {
            _id: 'fine1',
            amount: 50.0,
            overdueDays: 5,
            status: 'unpaid',
            loanId: { bookId: { title: 'Clean Architecture' } },
          },
        ],
      }),
    });

    render(<Fines />);

    await waitFor(() => {
      expect(screen.getByText(/Clean Architecture/i)).toBeInTheDocument();
      expect(screen.getByText(/Total Outstanding Balance/i)).toBeInTheDocument();
    });
  });

  it('Acceptance Criteria: UI shows Payment Processing state until confirmed by server/webhook', async () => {
    global.fetch.mockImplementation((url) => {
      if (url.includes('/api/v1/fines')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            data: [
              {
                _id: 'fine1',
                amount: 50.0,
                overdueDays: 5,
                status: 'unpaid',
                loanId: { bookId: { title: 'Clean Architecture' } },
              },
            ],
          }),
        });
      }

      if (url.includes('/api/v1/payments/create-order')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            data: {
              orderId: 'order_test_123',
              amount: 5000,
              amountInRupees: 50.0,
              currency: 'INR',
              keyId: 'rzp_test_mock_key',
            },
          }),
        });
      }

      if (url.includes('/status')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            data: {
              orderId: 'order_test_123',
              status: 'created',
            },
          }),
        });
      }

      return Promise.resolve({
        ok: true,
        json: async () => ({ success: true }),
      });
    });

    render(<Fines />);

    await waitFor(() => {
      expect(screen.getByText(/Clean Architecture/i)).toBeInTheDocument();
    });

    const payBtn = screen.getByRole('button', { name: /Pay ₹50.00 Now/i });
    fireEvent.click(payBtn);

    await waitFor(() => {
      // ACCEPTANCE CRITERIA F7.5: UI shows "Payment Processing..." until server webhook confirmation
      expect(screen.getByText(/Payment Processing.../i)).toBeInTheDocument();
    });
  });
});
