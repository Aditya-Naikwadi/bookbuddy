import { Clock, RefreshCw, Loader2 } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../../../api/client';

const fetchLoans = async () => {
  const { data } = await apiClient.get('/dashboards/student/loans');
  return data.data; // { active, history }
};

const fetchQueue = async () => {
  const { data } = await apiClient.get('/dashboards/student/reservations/queue');
  return data.data; // array
};

const MyLoans = () => {
  const queryClient = useQueryClient();

  const { data: loansData, isLoading: loansLoading } = useQuery({
    queryKey: ['my-loans'],
    queryFn: fetchLoans,
  });

  const { data: queueData, isLoading: queueLoading } = useQuery({
    queryKey: ['my-queue'],
    queryFn: fetchQueue,
  });

  const renewMutation = useMutation({
    mutationFn: async (loanId) => {
      const { data } = await apiClient.post(`/dashboards/student/loans/${loanId}/renew`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-loans'] });
      alert('Book renewed successfully!');
    },
    onError: (err) => {
      alert(err.response?.data?.message || 'Failed to renew book');
    }
  });

  const isLoading = loansLoading || queueLoading;

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-20">
        <Loader2 className="animate-spin text-indigo-600" size={32} />
      </div>
    );
  }

  const { active = [], history = [] } = loansData || {};

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-serif font-bold text-slate-900">My Borrowing</h1>
      
      {/* Current Browsing Status & One-Click Renewals */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-6">
        <div className="p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
          <h2 className="text-xl font-bold">Currently Borrowed ({active.length})</h2>
        </div>
        <div className="p-6">
          <div className="space-y-4">
            {active.length === 0 ? (
              <p className="text-slate-500 text-sm">You currently have no active loans.</p>
            ) : (
              active.map((loan) => (
                <div key={loan._id} className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 border border-indigo-100 rounded-lg bg-indigo-50/30">
                  <div className="flex items-center gap-4">
                    {loan.bookId?.coverImage ? (
                      <img src={loan.bookId.coverImage} alt={loan.bookId.title} className="w-16 h-20 rounded shadow-sm object-cover" />
                    ) : (
                      <div className="w-16 h-20 bg-slate-200 rounded shrink-0 shadow-sm"></div>
                    )}
                    <div>
                      <h3 className="font-bold text-slate-900 text-lg">{loan.bookId?.title}</h3>
                      <p className="text-sm text-slate-500">Issued: {new Date(loan.issueDate).toLocaleDateString()}</p>
                      <p className={`text-sm font-medium mt-1 flex items-center gap-1 ${new Date(loan.dueDate) < new Date() ? 'text-danger' : 'text-amber-600'}`}>
                        <Clock size={14} /> Due: {new Date(loan.dueDate).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => renewMutation.mutate(loan._id)}
                      disabled={renewMutation.isPending}
                      className="bg-indigo-600 text-white px-5 py-2 rounded-lg font-medium hover:bg-indigo-700 w-full md:w-auto flex items-center justify-center gap-2 transition-colors shadow-sm disabled:opacity-50"
                    >
                      <RefreshCw size={18} className={renewMutation.isPending ? 'animate-spin' : ''} />
                      {renewMutation.isPending ? 'Renewing...' : 'Renew Now'}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Queue Tracking */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-5 border-b border-slate-100">
            <h2 className="font-bold text-lg">My Reservations Queue</h2>
          </div>
          <div className="p-5 space-y-4">
            {queueData?.length === 0 ? (
              <p className="text-slate-500 text-sm">No active holds.</p>
            ) : (
              queueData?.map((item) => (
                <div key={item._id} className="flex justify-between items-center p-3 border border-amber-100 bg-amber-50 rounded-lg">
                  <div>
                    <h4 className="font-bold text-slate-900">{item.bookId?.title}</h4>
                    <p className="text-xs text-slate-600 mt-1">Status: {item.status.replace('_', ' ')}</p>
                  </div>
                  <div className="text-right">
                    <span className="block text-2xl font-bold text-amber-600">#{item.queuePosition}</span>
                    <span className="text-xs text-amber-700 font-medium uppercase tracking-wider">in line</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Browsing History */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-5 border-b border-slate-100">
            <h2 className="font-bold text-lg">Browsing History</h2>
          </div>
          <div className="p-0">
            {history.length === 0 ? (
              <p className="text-slate-500 text-sm p-5">No borrowing history yet.</p>
            ) : (
              <table className="w-full text-sm text-left text-slate-600">
                <tbody>
                  {history.map((loan) => (
                    <tr key={loan._id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                      <td className="p-4 font-medium text-slate-900">{loan.bookId?.title}</td>
                      <td className="p-4">Returned on {new Date(loan.returnDate).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MyLoans;
