import { Outlet } from 'react-router-dom';

const AuthLayout = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="w-full max-w-md p-8 bg-white rounded-xl shadow-md border border-slate-200">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-serif font-bold text-indigo-600 mb-2">BookBuddy</h1>
          <p className="text-slate-500">Student Library Dashboard</p>
        </div>
        <Outlet />
      </div>
    </div>
  );
};

export default AuthLayout;
