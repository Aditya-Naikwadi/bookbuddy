import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ReviewList from '../../components/ReviewList';
import * as reviewApi from '../../api/reviewApi';

vi.mock('../../api/reviewApi', () => ({
  getBookReviews: vi.fn(),
  submitBookReview: vi.fn(),
}));

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

describe('ReviewList Component UI & Client-Side Validation', () => {
  let queryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.clearAllMocks();
  });

  it('Submit button is disabled until a star value is selected', async () => {
    reviewApi.getBookReviews.mockResolvedValue({
      data: [],
      total: 0,
      page: 1,
      hasMore: false,
    });

    render(
      <QueryClientProvider client={queryClient}>
        <ReviewList bookId="book-123" currentUserId="user-1" />
      </QueryClientProvider>
    );

    const submitBtn = screen.getByTestId('submit-review-button');
    expect(submitBtn).toBeDisabled();

    // Select a 4-star rating
    const star4 = screen.getByTestId('star-button-4');
    fireEvent.click(star4);

    expect(submitBtn).not.toBeDisabled();
  });

  it('Acceptance Criteria: Attempting to submit with no star selected is blocked client-side before network request fires', async () => {
    reviewApi.getBookReviews.mockResolvedValue({
      data: [],
      total: 0,
      page: 1,
      hasMore: false,
    });

    render(
      <QueryClientProvider client={queryClient}>
        <ReviewList bookId="book-123" currentUserId="user-1" />
      </QueryClientProvider>
    );

    const form = screen.getByTestId('review-form');
    fireEvent.submit(form);

    // Network request should NOT be called
    expect(reviewApi.submitBookReview).not.toHaveBeenCalled();

    // Error message should be shown
    expect(screen.getByTestId('review-error-message')).toHaveTextContent(
      'Please select a star rating before submitting.'
    );
  });

  it('Pre-fills form with existing user review for editing rather than duplicate submission', async () => {
    const existingReview = {
      _id: 'rev-1',
      userId: { _id: 'user-1', name: 'Existing User' },
      bookId: 'book-123',
      rating: 5,
      text: 'My existing great review',
      status: 'approved',
    };

    reviewApi.getBookReviews.mockResolvedValue({
      data: [existingReview],
      total: 1,
      page: 1,
      hasMore: false,
    });

    render(
      <QueryClientProvider client={queryClient}>
        <ReviewList bookId="book-123" currentUserId="user-1" />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('review-textarea')).toHaveValue('My existing great review');
    });

    const submitBtn = screen.getByTestId('submit-review-button');
    expect(submitBtn).toHaveTextContent('Update Review');
  });
});
