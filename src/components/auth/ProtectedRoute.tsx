import { type ReactNode } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { ArrowLeft, GraduationCap, ShieldAlert } from "lucide-react";
import { useAuth } from "../../hooks/useAuth";

interface Props {
  children: ReactNode;
  allowedRoles?: string[];
}

export default function ProtectedRoute({ children, allowedRoles }: Props) {
  const { isAuthenticated, loading, role } = useAuth();
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 text-lg font-medium text-slate-700">
        Loading...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!allowedRoles || allowedRoles.length === 0) {
    return <>{children}</>;
  }

  const hasAccess = allowedRoles.some((allowedRole) => role?.name === allowedRole);

  if (!hasAccess) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
        <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-100 text-red-600">
            <ShieldAlert className="h-8 w-8" />
          </div>

          <div className="mb-4 flex items-center justify-center gap-2 text-emerald-600">
            <GraduationCap className="h-5 w-5" />
            <span className="text-sm font-semibold uppercase tracking-[0.2em]">
              Grandessa
            </span>
          </div>

          <h1 className="text-2xl font-semibold text-slate-900">Access Denied</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            You do not have permission to view this page. Please contact an
            administrator if you believe this is an error.
          </p>

          <button
            type="button"
            onClick={() => navigate(-1)}
            className="mt-6 inline-flex items-center justify-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Go back
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}