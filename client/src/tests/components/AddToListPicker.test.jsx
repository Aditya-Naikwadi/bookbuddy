import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AddToListPicker from '../../components/AddToListPicker';
import * as readingListApi from '../../api/readingListApi';

vi.mock('../../api/readingListApi', () => ({
  getReadingLists: vi.fn(),
  createReadingList: vi.fn(),
  addReadingListItem: vi.fn(),
}));

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

describe('AddToListPicker component', () => {
  let queryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.clearAllMocks();
  });

  it('renders trigger button and opens modal when clicked', async () => {
    readingListApi.getReadingLists.mockResolvedValue({
      success: true,
      data: [
        {
          _id: 'list-123',
          name: 'CS Core Books',
          visibility: 'private',
          items: [],
        },
      ],
    });

    render(
      <QueryClientProvider client={queryClient}>
        <AddToListPicker bookId="book-999" />
      </QueryClientProvider>
    );

    const triggerButton = screen.getByRole('button', { name: /add to list/i });
    expect(triggerButton).toBeInTheDocument();

    fireEvent.click(triggerButton);

    expect(screen.getByText(/add to reading list/i)).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText('CS Core Books')).toBeInTheDocument();
    });
  });

  it('works unmodified when passed a book object or bookId string', async () => {
    readingListApi.getReadingLists.mockResolvedValue({
      success: true,
      data: [],
    });

    // Test with book object
    const { unmount } = render(
      <QueryClientProvider client={queryClient}>
        <AddToListPicker book={{ _id: 'book-object-777', title: 'Clean Architecture' }} />
      </QueryClientProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: /add to list/i }));
    expect(screen.getByText(/add to reading list/i)).toBeInTheDocument();

    unmount();

    // Test with bookId string
    const queryClient2 = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient2}>
        <AddToListPicker bookId="book-string-888" />
      </QueryClientProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: /add to list/i }));
    expect(screen.getByText(/add to reading list/i)).toBeInTheDocument();
  });

  it('handles list item addition when a shelf is clicked', async () => {
    readingListApi.getReadingLists.mockResolvedValue({
      success: true,
      data: [
        {
          _id: 'shelf-1',
          name: 'Architecture Shelf',
          visibility: 'private',
          items: [],
        },
      ],
    });
    readingListApi.addReadingListItem.mockResolvedValue({
      success: true,
      data: { _id: 'shelf-1' },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <AddToListPicker bookId="book-456" />
      </QueryClientProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: /add to list/i }));

    const shelfButton = await screen.findByText('Architecture Shelf');
    fireEvent.click(shelfButton);

    await waitFor(() => {
      expect(readingListApi.addReadingListItem).toHaveBeenCalledWith('shelf-1', {
        bookId: 'book-456',
      });
    });
  });

  it('allows creating a new list inline', async () => {
    readingListApi.getReadingLists.mockResolvedValue({
      success: true,
      data: [],
    });
    readingListApi.createReadingList.mockResolvedValue({
      _id: 'new-shelf-99',
      name: 'Exam Prep Shelf',
      visibility: 'private',
    });
    readingListApi.addReadingListItem.mockResolvedValue({
      success: true,
    });

    render(
      <QueryClientProvider client={queryClient}>
        <AddToListPicker bookId="book-100" />
      </QueryClientProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: /add to list/i }));

    const createToggleBtn = await screen.findByRole('button', { name: /create new list/i });
    fireEvent.click(createToggleBtn);

    const nameInput = screen.getByPlaceholderText(/list name/i);
    fireEvent.change(nameInput, { target: { value: 'Exam Prep Shelf' } });

    const submitBtn = screen.getByRole('button', { name: /create & add/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(readingListApi.createReadingList).toHaveBeenCalledWith({
        name: 'Exam Prep Shelf',
        title: 'Exam Prep Shelf',
        description: '',
        visibility: 'private',
      });
      expect(readingListApi.addReadingListItem).toHaveBeenCalledWith('new-shelf-99', {
        bookId: 'book-100',
      });
    });
  });
});
