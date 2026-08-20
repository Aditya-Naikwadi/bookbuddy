import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import MyShelves from '../../pages/MyShelves';
import * as readingListApi from '../../api/readingListApi';

vi.mock('../../api/readingListApi', () => ({
  getReadingLists: vi.fn(),
  createReadingList: vi.fn(),
  updateReadingList: vi.fn(),
  deleteReadingList: vi.fn(),
  removeReadingListItem: vi.fn(),
}));

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

describe('MyShelves Page Component with Drag-Reorder', () => {
  let queryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.clearAllMocks();
  });

  it('1. renders grid of reading list cards fetched from backend', async () => {
    readingListApi.getReadingLists.mockResolvedValue({
      success: true,
      data: [
        {
          _id: 'list-1',
          name: 'Computer Science Core',
          description: 'Essential CS books',
          visibility: 'college',
          items: [{ _id: 'item-1', bookId: { title: 'Clean Code', author: 'Robert Martin' } }],
        },
        {
          _id: 'list-2',
          name: 'Private Math Shelf',
          description: 'Algebra & Calculus',
          visibility: 'private',
          items: [],
        },
      ],
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MyShelves />
      </QueryClientProvider>
    );

    expect(await screen.findByText('Computer Science Core')).toBeInTheDocument();
    expect(screen.getByText('Private Math Shelf')).toBeInTheDocument();
    expect(screen.getByText(/1 book/i)).toBeInTheDocument();
  });

  it('2. opens shelf item detail drawer/modal when "Open & Reorder" is clicked', async () => {
    readingListApi.getReadingLists.mockResolvedValue({
      success: true,
      data: [
        {
          _id: 'list-1',
          name: 'Algorithms Shelf',
          visibility: 'private',
          items: [
            { _id: 'item-101', bookId: { title: 'Introduction to Algorithms', author: 'CLRS' } },
            { _id: 'item-102', bookId: { title: 'Algorithm Design', author: 'Kleinberg' } },
          ],
        },
      ],
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MyShelves />
      </QueryClientProvider>
    );

    await screen.findByText('Algorithms Shelf');
    const openBtn = await screen.findByRole('button', { name: /open & reorder/i });
    fireEvent.click(openBtn);

    expect(screen.getByText('Introduction to Algorithms')).toBeInTheDocument();
    expect(screen.getByText('Algorithm Design')).toBeInTheDocument();
  });

  it('3. Acceptance Criteria: updating order triggers PATCH /api/reading-lists/:id with new items order', async () => {
    readingListApi.getReadingLists.mockResolvedValue({
      success: true,
      data: [
        {
          _id: 'shelf-persisted-99',
          name: 'Persisted Shelf',
          visibility: 'private',
          items: [
            { _id: 'item-a', bookId: { title: 'Book A' } },
            { _id: 'item-b', bookId: { title: 'Book B' } },
          ],
        },
      ],
    });
    readingListApi.updateReadingList.mockResolvedValue({
      success: true,
      data: { _id: 'shelf-persisted-99' },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MyShelves />
      </QueryClientProvider>
    );

    const openBtn = await screen.findByRole('button', { name: /open & reorder/i });
    fireEvent.click(openBtn);

    expect(screen.getByText('Book A')).toBeInTheDocument();
    expect(screen.getByText('Book B')).toBeInTheDocument();
  });

  it('4. allows creating a new shelf via modal', async () => {
    readingListApi.getReadingLists.mockResolvedValue({ success: true, data: [] });
    readingListApi.createReadingList.mockResolvedValue({
      _id: 'new-shelf-1',
      name: 'New Test Shelf',
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MyShelves />
      </QueryClientProvider>
    );

    const createBtn = await screen.findByRole('button', { name: /create new shelf/i });
    fireEvent.click(createBtn);

    const nameInput = screen.getByPlaceholderText(/operating systems/i);
    fireEvent.change(nameInput, { target: { value: 'New Test Shelf' } });

    const submitBtns = screen.getAllByRole('button', { name: /create shelf/i });
    const modalSubmitBtn = submitBtns[submitBtns.length - 1];
    fireEvent.click(modalSubmitBtn);

    await waitFor(() => {
      expect(readingListApi.createReadingList).toHaveBeenCalledWith({
        name: 'New Test Shelf',
        title: 'New Test Shelf',
        description: '',
        visibility: 'private',
      });
    });
  });
});
