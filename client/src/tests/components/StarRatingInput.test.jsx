import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import StarRatingInput from '../../components/StarRatingInput';

describe('StarRatingInput Component', () => {
  it('renders 5 star buttons by default', () => {
    render(<StarRatingInput value={0} onChange={() => {}} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBe(5);
  });

  it('triggers onChange with selected rating when a star is clicked', () => {
    const handleChange = vi.fn();
    render(<StarRatingInput value={0} onChange={handleChange} />);
    const thirdStar = screen.getByTestId('star-button-3');

    fireEvent.click(thirdStar);
    expect(handleChange).toHaveBeenCalledWith(3);
  });

  it('does not trigger onChange when disabled or readOnly', () => {
    const handleChange = vi.fn();
    render(<StarRatingInput value={3} onChange={handleChange} disabled />);
    const star = screen.getByTestId('star-button-4');

    fireEvent.click(star);
    expect(handleChange).not.toHaveBeenCalled();
  });
});
