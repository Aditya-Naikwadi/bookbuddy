import { useState, useEffect } from "react";
import { ONBOARDING_TOUR_STEPS } from "../onboarding/tourSteps";
import { Sparkles, ChevronRight, CheckCircle2, X } from "lucide-react";

export const OnboardingTour = ({
  user,
  onCompleteTour,
  forceStart = false,
}) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    // F9.3: Automatic first-run trigger if user hasSeenOnboarding is false OR forceStart is true
    if (forceStart) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Synchronizing onboarding active state with external forceStart trigger
      setIsActive(true);
      setCurrentStepIndex(0);
    } else if (user && user.hasSeenOnboarding === false) {
      setIsActive(true);
      setCurrentStepIndex(0);
    }
  }, [user, forceStart]);

  if (!isActive) return null;

  const currentStep =
    ONBOARDING_TOUR_STEPS[currentStepIndex] || ONBOARDING_TOUR_STEPS[0];
  const isLastStep = currentStepIndex === ONBOARDING_TOUR_STEPS.length - 1;

  const handleNext = async () => {
    if (isLastStep) {
      setIsActive(false);
      // Mark onboarding as completed on backend profile (F9.3)
      try {
        const token = localStorage.getItem("token");
        await fetch("/api/v1/users/me", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ hasSeenOnboarding: true }),
        });
      } catch (err) {
        console.error("Error saving onboarding completion:", err);
      }

      if (typeof onCompleteTour === "function") {
        onCompleteTour();
      }
    } else {
      setCurrentStepIndex((prev) => prev + 1);
    }
  };

  const handleSkip = () => {
    setIsActive(false);
    if (typeof onCompleteTour === "function") {
      onCompleteTour();
    }
  };

  return (
    <div className="fixed bottom-8 right-8 z-50 max-w-md w-full bg-slate-900 border border-indigo-500/40 rounded-3xl p-6 shadow-2xl backdrop-blur-xl text-slate-100 animate-slide-up">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-indigo-400 font-bold text-xs uppercase tracking-wider">
          <Sparkles className="w-4 h-4 text-indigo-400" />
          <span>
            Platform Onboarding Tour ({currentStepIndex + 1}/
            {ONBOARDING_TOUR_STEPS.length})
          </span>
        </div>

        <button
          onClick={handleSkip}
          className="text-slate-400 hover:text-white p-1 rounded-lg bg-slate-800"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <h3 className="text-base font-bold text-white mb-1.5">
        {currentStep.title}
      </h3>
      <p className="text-xs text-slate-300 leading-relaxed mb-6">
        {currentStep.content}
      </p>

      <div className="flex items-center justify-between border-t border-slate-800/80 pt-4">
        <button
          onClick={handleSkip}
          className="text-xs font-semibold text-slate-400 hover:text-white"
        >
          Skip Tour
        </button>

        <button
          onClick={handleNext}
          className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-colors shadow-md flex items-center gap-1.5"
        >
          <span>{isLastStep ? "Finish Tour" : "Next Step"}</span>
          {isLastStep ? (
            <CheckCircle2 className="w-3.5 h-3.5" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5" />
          )}
        </button>
      </div>
    </div>
  );
};

export default OnboardingTour;
