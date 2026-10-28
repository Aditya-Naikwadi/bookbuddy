/* eslint-disable jsx-a11y/aria-proptypes */
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { SectionLabel } from "../components/ui/SectionLabel";
import { cn } from "../utils/cn";

export const FAQ = () => {
  const { t } = useTranslation();
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const faqs = [
    {
      question: t("landing.faqSection.q1", "How do I borrow physical books from my campus library?"),
      answer: t("landing.faqSection.a1", "Browse the catalog, click Reserve on any available volume, and show your digital patron pass at the circulation desk."),
    },
    {
      question: t("landing.faqSection.q2", "Are the e-resources completely free to read?"),
      answer: t("landing.faqSection.a2", "Yes! All 70,000+ e-resources in BookBuddy are open-access, public domain, or licensed for campus students at zero cost."),
    },
    {
      question: t("landing.faqSection.q3", "How do reading streaks work?"),
      answer: t("landing.faqSection.a3", "Check in daily on your student dashboard or read an e-book for at least 5 minutes to keep your streak alive."),
    },
    {
      question: t("landing.faqSection.q4", "What happens if I have an overdue fine?"),
      answer: t("landing.faqSection.a4", "You can view your fine breakdown in the student portal and settle dues online or at the library circulation counter."),
    },
  ];

  const toggleAccordion = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section
      id="faq"
      className="bg-surface py-16 md:py-24 relative overflow-hidden"
    >
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-gradient-to-bl from-indigo-500/5 to-transparent rounded-full blur-[100px] pointer-events-none" />

      <div className="relative max-w-4xl mx-auto px-6 md:px-12 xl:px-24">
        <div className="text-center mb-12 md:mb-16">
          <SectionLabel className="mx-auto">{t("landing.faqSection.label", "Got Questions?")}</SectionLabel>
          <h2 className="font-serif text-2xl sm:text-3xl md:text-4xl text-ink mt-4 hover:brightness-110 transition-all duration-300 cursor-default select-text">
            {t("landing.faqSection.heading", "Frequently Asked Questions")}
          </h2>
        </div>

        <div className="flex flex-col gap-4">
          {faqs.map((faq, index) => {
            const isOpen = openIndex === index;
            return (
              <div
                key={index}
                className={cn(
                  "border border-edge rounded-2xl overflow-hidden transition-colors duration-300 group",
                  isOpen ? "bg-void/50 border-ember/30" : "bg-transparent hover:bg-void/30 hover:border-edge/90",
                )}
              >
                <button
                  onClick={() => toggleAccordion(index)}
                  className="w-full text-left px-5 sm:px-6 py-4 sm:py-5 flex items-center justify-between focus:outline-none cursor-pointer"
                  aria-expanded={isOpen}
                >
                  <span className="font-semibold text-base sm:text-lg text-ink pr-6 sm:pr-8 group-hover:text-ember transition-colors duration-200">
                    {faq.question}
                  </span>
                  <motion.div
                    animate={{ rotate: isOpen ? 180 : 0 }}
                    transition={{ duration: 0.3, ease: "easeInOut" }}
                    className="flex-shrink-0"
                  >
                    <ChevronDown className="w-5 h-5 text-muted group-hover:text-ember transition-colors" />
                  </motion.div>
                </button>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: "easeInOut" }}
                    >
                      <div className="px-5 sm:px-6 pb-5 text-muted leading-relaxed text-sm sm:text-base select-text">
                        {faq.answer}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
