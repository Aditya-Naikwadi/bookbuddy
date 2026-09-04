/* eslint-disable jsx-a11y/aria-proptypes */
import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { SectionLabel } from "../components/ui/SectionLabel";
import { cn } from "../utils/cn";

const faqs = [
  {
    question: "How many books can I borrow at once?",
    answer:
      "You can borrow up to 5 physical books and 10 e-books simultaneously. The standard borrowing period is 14 days, with the option to renew twice if there are no pending reservations.",
  },
  {
    question: "Are there any late fees?",
    answer:
      "We believe in transparent policies. Overdue physical books incur a small fee of $0.50 per day, capped at the replacement cost of the book. E-books automatically return at the end of your period, so there are never late fees for digital content!",
  },
  {
    question: "Can I reserve a book that's currently checked out?",
    answer:
      "Yes! Simply search for the book and click 'Join Queue'. You'll see your exact position in the line, and we'll send you an email or push notification the moment it's returned and ready for you.",
  },
  {
    question: "Do I need a physical library card?",
    answer:
      "No. Your digital library card is accessible right from the BookBuddy app. You can use it to scan at self-checkout kiosks or present it to our librarians.",
  },
  {
    question: "How do reading streaks work?",
    answer:
      "Every day you spend at least 15 minutes reading an e-book through the app, or every time you borrow/return a physical book on time, you build your streak. Maintain your streak to unlock special badges and extended borrowing privileges.",
  },
];

export const FAQ = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

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
          <SectionLabel className="mx-auto">Got Questions?</SectionLabel>
          <h2 className="font-serif text-3xl md:text-4xl text-ink mt-4">
            Frequently Asked Questions
          </h2>
        </div>

        <div className="flex flex-col gap-4">
          {faqs.map((faq, index) => {
            const isOpen = openIndex === index;
            return (
              <div
                key={index}
                className={cn(
                  "border border-edge rounded-2xl overflow-hidden transition-colors duration-300",
                  isOpen ? "bg-void/50" : "bg-transparent hover:bg-void/30",
                )}
              >
                <button
                  onClick={() => toggleAccordion(index)}
                  className="w-full text-left px-6 py-5 flex items-center justify-between focus:outline-none"
                  aria-expanded={isOpen}
                >
                  <span className="font-semibold text-lg text-ink pr-8">
                    {faq.question}
                  </span>
                  <motion.div
                    animate={{ rotate: isOpen ? 180 : 0 }}
                    transition={{ duration: 0.3, ease: "easeInOut" }}
                    className="flex-shrink-0"
                  >
                    <ChevronDown className="w-5 h-5 text-muted" />
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
                      <div className="px-6 pb-5 text-muted leading-relaxed">
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
