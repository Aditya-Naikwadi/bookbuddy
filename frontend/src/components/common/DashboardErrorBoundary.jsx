import React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

class DashboardErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Dashboard Widget Error:", error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onRetry) {
      this.props.onRetry();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="bg-rose-50/80 border border-rose-200 p-3.5 rounded-2xl flex flex-col items-center justify-center text-center text-rose-900 text-xs min-h-[100px] shadow-xs">
          <AlertTriangle className="w-5 h-5 text-rose-500 mb-1 flex-shrink-0" />
          <span className="font-bold mb-0.5">
            {this.props.widgetName || "Widget"} Unavailable
          </span>
          <p className="text-[10px] text-rose-600 mb-2 max-w-[200px] truncate">
            {this.state.error?.message ||
              "An unexpected rendering error occurred."}
          </p>
          <button
            onClick={this.handleRetry}
            className="px-2.5 py-1 bg-white border border-rose-300 rounded-lg text-rose-700 font-semibold hover:bg-rose-100 transition-colors flex items-center gap-1 shadow-2xs"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Retry</span>
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default DashboardErrorBoundary;
