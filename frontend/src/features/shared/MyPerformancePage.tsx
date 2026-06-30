import { useEffect, useMemo, useState } from "react";
import { useTopHeaderSearch } from "../../hooks/useTopHeaderSearch";
import api from "../../utils/axiosInstance";
import {
  card,
  hrPageWrap,
  tableHead,
  textPrimary,
  textSecondary,
} from "../HRdashboard/hrTheme";

type PerformanceReview = {
  id: string;
  employeeId: string;
  employeeName?: string;
  reviewType: string;
  period: string;
  rating: string;
  notes?: string;
};

export default function MyPerformancePage() {
  const [search] = useTopHeaderSearch();
  const [reviews, setReviews] = useState<PerformanceReview[]>([]);

  useEffect(() => {
    const dummyReviews: PerformanceReview[] = [
      {
        id: "review-1",
        employeeId: localStorage.getItem("employeeId") || "EMP0023",
        employeeName: localStorage.getItem("userName") || "Zenvora Employee",
        reviewType: "Annual Review",
        period: "FY 2025-2026",
        rating: "Exceeds Expectations (4/5)",
        notes: "Demonstrated strong ownership of projects and excellent teamwork throughout the year.",
      },
      {
        id: "review-2",
        employeeId: localStorage.getItem("employeeId") || "EMP0023",
        employeeName: localStorage.getItem("userName") || "Zenvora Employee",
        reviewType: "Mid-Year Review",
        period: "H1 2025",
        rating: "Meets Expectations (3/5)",
        notes: "Consistent performance. Met all key milestones on time. Focus on leadership opportunities next.",
      }
    ];

    const fetchReviews = async () => {
      try {
        const response = await api.get("/api/performance-reviews/my");
        const backendReviews = response.data.reviews || [];
        setReviews(backendReviews.length > 0 ? backendReviews : dummyReviews);
      } catch {
        setReviews(dummyReviews);
      }
    };

    fetchReviews();
  }, []);

  const filteredReviews = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return reviews;

    return reviews.filter((review) =>
      [review.employeeId, review.employeeName || "", review.reviewType, review.period, review.rating, review.notes || ""]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [reviews, search]);

  return (
    <div className={hrPageWrap}>
      <div className="max-w-[1280px] mx-auto">
        <div className="rounded-lg p-4" style={card}>
          <div className="overflow-x-auto rounded-lg" style={{ border: "1px solid var(--border)" }}>
            <table className="w-full min-w-[900px] text-sm">
              <thead style={tableHead}>
                <tr>
                  <th className="px-5 py-4 text-left font-semibold">Employee ID</th>
                  <th className="px-5 py-4 text-left font-semibold">Employee Name</th>
                  <th className="px-5 py-4 text-left font-semibold">Review Type</th>
                  <th className="px-5 py-4 text-left font-semibold">Period</th>
                  <th className="px-5 py-4 text-left font-semibold">Rating</th>
                  <th className="px-5 py-4 text-left font-semibold">Comments</th>
                </tr>
              </thead>
              <tbody>
                {filteredReviews.map((review) => (
                  <tr key={review.id} className="border-t" style={{ borderColor: "var(--border)" }}>
                    <td className="px-5 py-4 font-semibold" style={textPrimary}>
                      {review.employeeId || "-"}
                    </td>
                    <td className="px-5 py-4" style={textSecondary}>
                      {review.employeeName || "-"}
                    </td>
                    <td className="px-5 py-4" style={textSecondary}>
                      {review.reviewType}
                    </td>
                    <td className="px-5 py-4" style={textSecondary}>
                      {review.period}
                    </td>
                    <td className="px-5 py-4" style={textSecondary}>
                      {review.rating}
                    </td>
                    <td className="px-5 py-4" style={textSecondary}>
                      {review.notes || "-"}
                    </td>
                  </tr>
                ))}

                {filteredReviews.length === 0 && (
                  <tr className="border-t" style={{ borderColor: "var(--border)" }}>
                    <td colSpan={6} className="px-5 py-12 text-center text-sm" style={textSecondary}>
                      No performance reviews found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
