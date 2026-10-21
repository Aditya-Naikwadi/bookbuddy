import React from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "../ui/Button";
import { captureError } from "../../utils/analytics";

/**
 * SectionErrorBoundary
 * Wraps major landing page and layout sections to isolate failures.
 * If one section crashes, other sections stay completely intact and operable.
 */
export class SectionErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    captureError(error, {
      section: this.props.sectionName || "Section",
      componentStack: errorInfo?.componentStack,
    });
    console.warn(
      `[SectionErrorBoundary: ${this.props.sectionName || "Section"}] error:`,
      error?.message || error,
      errorInfo?.componentStack,
    );
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <section
          role="region"
          aria-label={`Error in ${this.props.sectionName || "section"}`}
          className="py-16 px-6 text-center bg-surface/30 border border-amber-500/20 rounded-2xl my-8 max-w-4xl mx-auto"
        >
          <div className="w-12 h-12 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto mb-3 text-amber-500">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-serif font-semibold text-ink mb-2">
            Temporarily unable to load{" "}
            {this.props.sectionName || "this section"}
          </h3>
          <p className="text-sm text-muted mb-5 max-w-md mx-auto">
            The rest of the library remains fully accessible. You can retry
            loading this section.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={this.handleReset}
            className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
            Retry Section
          </Button>
        </section>
      );
    }

    return this.props.children;
  }
}

export default SectionErrorBoundary;
