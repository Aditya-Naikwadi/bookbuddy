import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { academicSupportApi } from '../api/academicSupportApi';
import useAuthStore from '../store/authStore';
import { useState } from 'react';

export const useAcademicSupport = () => {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const [liveAnnouncement, setLiveAnnouncement] = useState('');

  // 1. Query: Fetch My Complaints
  const {
    data: complaints = [],
    isLoading: loadingComplaints,
    refetch: refetchComplaints,
  } = useQuery({
    queryKey: ['my-complaints'],
    queryFn: academicSupportApi.getMyComplaints,
    staleTime: 30000,
  });

  // 2. Query: Fetch Book Suggestions (Filtered client-side for my submissions)
  const {
    data: allSuggestions = [],
    isLoading: loadingSuggestions,
    refetch: refetchSuggestions,
  } = useQuery({
    queryKey: ['all-book-suggestions'],
    queryFn: academicSupportApi.getBookSuggestions,
    staleTime: 30000,
  });

  const mySuggestions = allSuggestions.filter((s) => {
    const suggestedUserId = s.suggestedBy?._id?.toString() || s.suggestedBy?.toString();
    return suggestedUserId === user?._id?.toString();
  });

  // 3. Query: Fetch Feedback (Filtered client-side for my submissions)
  const {
    data: allFeedback = [],
    isLoading: loadingFeedback,
    refetch: refetchFeedback,
  } = useQuery({
    queryKey: ['all-feedback'],
    queryFn: academicSupportApi.getFeedback,
    staleTime: 30000,
  });

  const myFeedback = allFeedback.filter((f) => {
    const submittedUserId = f.submittedBy?._id?.toString() || f.submittedBy?.toString();
    return submittedUserId === user?._id?.toString();
  });

  // 4. Mutation: Submit Book Suggestion
  const suggestionMutation = useMutation({
    mutationFn: ({ title, author, reason }) =>
      academicSupportApi.submitBookSuggestion(title, author, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-book-suggestions'] });
      setLiveAnnouncement('Purchase suggestion submitted successfully.');
    },
    onError: (err) => {
      setLiveAnnouncement(`Submission failed. ${err.response?.data?.message || err.message}`);
    },
  });

  // 5. Mutation: Submit Complaint
  const complaintMutation = useMutation({
    mutationFn: ({ subject, description }) =>
      academicSupportApi.submitComplaint(subject, description),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-complaints'] });
      setLiveAnnouncement('Complaint submitted successfully. An administrator will review it.');
    },
    onError: (err) => {
      setLiveAnnouncement(`Submission failed. ${err.response?.data?.message || err.message}`);
    },
  });

  // 6. Mutation: Submit General Feedback
  const feedbackMutation = useMutation({
    mutationFn: ({ category, message, rating }) =>
      academicSupportApi.submitFeedback(category, message, rating),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-feedback'] });
      setLiveAnnouncement('Feedback submitted successfully. Thank you for your review.');
    },
    onError: (err) => {
      setLiveAnnouncement(`Submission failed. ${err.response?.data?.message || err.message}`);
    },
  });

  const isLoading = loadingComplaints || loadingSuggestions || loadingFeedback;

  return {
    complaints,
    mySuggestions,
    myFeedback,
    isLoading,
    refetchAll: () => {
      refetchComplaints();
      refetchSuggestions();
      refetchFeedback();
    },
    submitSuggestion: suggestionMutation.mutateAsync,
    isSubmittingSuggestion: suggestionMutation.isPending,
    submitComplaint: complaintMutation.mutateAsync,
    isSubmittingComplaint: complaintMutation.isPending,
    submitFeedback: feedbackMutation.mutateAsync,
    isSubmittingFeedback: feedbackMutation.isPending,
    liveAnnouncement,
  };
};

export default useAcademicSupport;
