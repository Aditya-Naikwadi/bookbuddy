import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { HelpModal } from '../../components/HelpModal';
import { OnboardingTour } from '../../components/OnboardingTour';

describe('Help Center & Onboarding Tour Component Suite (F9.1 - F9.4)', () => {
  const mockOnClose = vi.fn();
  const mockOnStartTour = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });
  });

  describe('F9.2 — Searchable Help Modal', () => {
    it('surfaces relevant article when searching a known keyword without page reload', () => {
      render(<HelpModal isOpen={true} onClose={mockOnClose} onStartTour={mockOnStartTour} />);

      const searchInput = screen.getByPlaceholderText(/Search help articles/i);
      fireEvent.change(searchInput, { target: { value: 'fine' } });

      // ACCEPTANCE CRITERIA F9.2: Searching known keyword surfaces relevant article
      expect(screen.getByText('Fine Settlement & Razorpay Payments')).toBeInTheDocument();
      expect(screen.queryByText('Borrowing Books & Loan Renewals')).not.toBeInTheDocument();
    });

    it('F9.4 — Replay tour button triggers tour on demand', () => {
      render(<HelpModal isOpen={true} onClose={mockOnClose} onStartTour={mockOnStartTour} />);

      const replayBtn = screen.getByRole('button', { name: /Replay Onboarding Tour/i });
      fireEvent.click(replayBtn);

      expect(mockOnClose).toHaveBeenCalled();
      expect(mockOnStartTour).toHaveBeenCalled();
    });
  });

  describe('F9.3 — First-Run Onboarding Tour & Profile State', () => {
    it('automatically triggers tour for new user with hasSeenOnboarding: false', () => {
      const newUser = { id: 'u123', hasSeenOnboarding: false };

      render(<OnboardingTour user={newUser} />);

      expect(screen.getByText(/Platform Onboarding Tour/i)).toBeInTheDocument();
      expect(screen.getByText('Welcome to BookBuddy!')).toBeInTheDocument();
    });

    it('does NOT automatically trigger tour for returning user with hasSeenOnboarding: true', () => {
      const returningUser = { id: 'u456', hasSeenOnboarding: true };

      const { container } = render(<OnboardingTour user={returningUser} />);

      expect(container.firstChild).toBeNull();
    });

    it('F9.4 — forces tour launch when forceStart is true regardless of profile state', () => {
      const returningUser = { id: 'u456', hasSeenOnboarding: true };

      render(<OnboardingTour user={returningUser} forceStart={true} />);

      expect(screen.getByText(/Platform Onboarding Tour/i)).toBeInTheDocument();
      expect(screen.getByText('Welcome to BookBuddy!')).toBeInTheDocument();
    });
  });
});
