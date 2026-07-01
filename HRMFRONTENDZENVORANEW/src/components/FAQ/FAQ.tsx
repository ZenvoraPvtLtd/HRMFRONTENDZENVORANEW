import { useState } from "react";
import { Plus, Minus } from "lucide-react";

interface FAQItem {
  question: string;
  answer: string;
}

interface FAQProps {
  faqs: FAQItem[];
  title?: string;
}

export default function FAQ({ faqs, title = "Frequently Asked Questions" }: FAQProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const toggleFAQ = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  const leftFaqs = faqs.filter((_, i) => i % 2 === 0);
  const rightFaqs = faqs.filter((_, i) => i % 2 !== 0);

  const renderFaqItem = (faq: FAQItem, originalIndex: number) => (
    <div
      key={originalIndex}
      className="rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow bg-white"
      style={{ 
        boxShadow: "0 4px 15px rgba(0,0,0,0.05)",
        background: "var(--bg-primary, #ffffff)"
      }}
    >
      <button
        onClick={() => toggleFAQ(originalIndex)}
        className="w-full px-6 py-5 flex items-center gap-4 text-left"
        style={{ background: "transparent", border: "none", cursor: "pointer" }}
      >
        <div 
          className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-colors"
          style={{ 
            backgroundColor: "#0066FF", 
            color: "#ffffff"
          }}
        >
          {openIndex === originalIndex ? (
            <Minus size={16} strokeWidth={3} />
          ) : (
            <Plus size={16} strokeWidth={3} />
          )}
        </div>
        <span className="text-base font-semibold flex-1" style={{ color: "var(--text-primary, #1f2937)" }}>
          {faq.question}
        </span>
      </button>
      {openIndex === originalIndex && (
        <div
          className="px-6 py-5 text-sm leading-relaxed"
          style={{ 
            color: "var(--text-secondary, #4b5563)",
            backgroundColor: "var(--bg-secondary, #f3f4f6)"
          }}
        >
          {faq.answer}
        </div>
      )}
    </div>
  );

  return (
    <div className="w-full max-w-6xl mx-auto py-12 px-4 sm:px-6">
      <h2 className="text-3xl sm:text-4xl font-extrabold text-center mb-10 text-gray-800" style={{ color: "var(--text-primary)" }}>
        {title}
      </h2>
      <div className="flex flex-col md:flex-row gap-8 items-start">
        <div className="flex-1 flex flex-col gap-4">
          {leftFaqs.map((faq, index) => renderFaqItem(faq, index * 2))}
        </div>
        <div className="flex-1 flex flex-col gap-4">
          {rightFaqs.map((faq, index) => renderFaqItem(faq, index * 2 + 1))}
        </div>
      </div>
    </div>
  );
}
