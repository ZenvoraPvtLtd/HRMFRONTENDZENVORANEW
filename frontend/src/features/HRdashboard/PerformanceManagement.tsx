import { Pencil, Plus, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import ConstrainedDropdown from "../../components/ConstrainedDropdown";
import { useTopHeaderSearch } from "../../hooks/useTopHeaderSearch";
import api from "../../utils/axiosInstance";
import {
  btnPrimary,
  btnSecondary,
  card,
  getStatusStyle,
  hrPageWrap,
  input,
  tableHead,
  textPrimary,
  textSecondary,
} from "./hrTheme";

type PerformanceReview = {
  id: string;
  employeeId: string;
  employeeName?: string;
  reviewType: string;
  period: string;
  rating: string;
  notes?: string;
};

type ReviewPayload = {
  employeeId: string;
  employeeName: string;
  reviewType: string;
  period: string;
  rating: string;
  notes: string;
};

export default function PerformanceManagement() {
  const [search] = useTopHeaderSearch();
  const [reviewsData, setReviewsData] = useState<PerformanceReview[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingReview, setEditingReview] = useState<PerformanceReview | null>(null);

  const fetchReviews = async () => {
    try {
      setIsLoading(true);
      const response = await api.get("/api/performance-reviews");
      setReviewsData(response.data.reviews || []);
    } catch {
      setReviewsData([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(() => fetchReviews(), 0);
    return () => clearTimeout(t);
  }, []);

  const filteredReviews = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return reviewsData;

    return reviewsData.filter((review) =>
      [review.employeeId, review.employeeName || "", review.reviewType, review.period, review.rating, review.notes || ""]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [reviewsData, search]);

  const createReview = async (payload: ReviewPayload) => {
    const nextPayload = {
      ...payload,
      employeeId: payload.employeeId.trim(),
      employeeName: payload.employeeName.trim(),
      period: payload.period.trim(),
    };

    if (!nextPayload.employeeName || !nextPayload.period) return;

    try {
      await api.post("/api/performance-reviews", nextPayload);
      setIsCreateOpen(false);
      fetchReviews();
    } catch {
      // API fail ho to koi message show nahi hoga
    }
  };

  const updateReview = async (payload: ReviewPayload) => {
    if (!editingReview) return;

    const nextPayload = {
      ...payload,
      employeeId: payload.employeeId.trim(),
      employeeName: payload.employeeName.trim(),
      period: payload.period.trim(),
    };

    if (!nextPayload.employeeName || !nextPayload.period) return;

    setReviewsData((prev) =>
      prev.map((review) =>
        review.id === editingReview.id ? { ...review, ...nextPayload } : review,
      ),
    );

    try {
      await api.put(`/api/performance-reviews/${editingReview.id}`, nextPayload);
      setEditingReview(null);
      fetchReviews();
    } catch {
      // API fail ho to koi message show nahi hoga
    }
  };

  const deleteReview = async (reviewId: string) => {
    const shouldDelete = window.confirm("Delete this performance review?");
    if (!shouldDelete) return;

    setReviewsData((prev) => prev.filter((review) => review.id !== reviewId));

    try {
      await api.delete(`/api/performance-reviews/${reviewId}`);
    } catch {
      // API fail ho to koi message show nahi hoga
    }
  };

  return (
    <div className={hrPageWrap}>
      <div className="max-w-[1280px] mx-auto">
        <div className="mb-5 flex justify-end">
          <button
            type="button"
            onClick={() => setIsCreateOpen(true)}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold"
            style={btnPrimary}
          >
            <Plus size={16} />
            Create Review
          </button>
        </div>

        <div className="rounded-lg p-4" style={card}>
          <div className="overflow-x-auto rounded-lg" style={{ border: "1px solid var(--border)" }}>
            <table className="w-full min-w-[980px] text-sm">
              <thead style={tableHead}>
                <tr>
                  <th className="px-5 py-4 text-left font-semibold">Employee ID</th>
                  <th className="px-5 py-4 text-left font-semibold">Employee Name</th>
                  <th className="px-5 py-4 text-left font-semibold">Review Type</th>
                  <th className="px-5 py-4 text-left font-semibold">Period</th>
                  <th className="px-5 py-4 text-left font-semibold">Rating</th>
                  <th className="px-5 py-4 text-left font-semibold">Comments</th>
                  <th className="px-5 py-4 text-right font-semibold whitespace-nowrap">Action</th>
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
                    <td className="px-5 py-4 text-right whitespace-nowrap">
                      <div className="inline-flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setEditingReview(review)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg"
                          style={btnSecondary}
                          aria-label="Edit review"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteReview(review.id)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg"
                          style={getStatusStyle("Rejected")}
                          aria-label="Delete review"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

                {filteredReviews.length === 0 && (
                  <tr className="border-t" style={{ borderColor: "var(--border)" }}>
                    <td colSpan={7} className="px-5 py-12 text-center text-sm" style={textSecondary}>
                      {isLoading ? "Loading reviews..." : "No performance reviews found"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {isCreateOpen && (
        <CreateReviewModal
          onClose={() => setIsCreateOpen(false)}
          onCreate={createReview}
        />
      )}

      {editingReview && (
        <CreateReviewModal
          review={editingReview}
          onClose={() => setEditingReview(null)}
          onCreate={updateReview}
        />
      )}
    </div>
  );
}

function CreateReviewModal({
  review,
  onClose,
  onCreate,
}: {
  review?: PerformanceReview;
  onClose: () => void;
  onCreate: (payload: ReviewPayload) => void;
}) {
  const isEdit = Boolean(review);
  const [employeeId, setEmployeeId] = useState(review?.employeeId || "");
  const [employeeName, setEmployeeName] = useState(review?.employeeName || "");
  const [reviewType, setReviewType] = useState(review?.reviewType || "mid-year");
  const [period, setPeriod] = useState(review?.period || "");
  const [rating, setRating] = useState(review?.rating || "3");
  const [notes, setNotes] = useState(review?.notes || "");

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 px-3 py-3 sm:items-center sm:px-4 sm:py-6">
      <div className="flex w-full max-w-md max-h-[92vh] flex-col overflow-hidden rounded-lg" style={card}>
        <div className="flex items-center justify-between gap-3 border-b px-4 py-3 sm:px-5 sm:py-4" style={{ borderColor: "var(--border)" }}>
          <h2 className="text-base font-bold sm:text-lg" style={textPrimary}>
            {isEdit ? "Edit Review" : "Create Review"}
          </h2>
          <button type="button" onClick={onClose} className="rounded-lg p-2" style={btnSecondary}>
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-5">
          <Field
            label="Employee ID"
            placeholder="Optional"
            value={employeeId}
            onChange={setEmployeeId}
          />
          <Field
            label="Employee Name"
            placeholder="Employee name"
            value={employeeName}
            onChange={setEmployeeName}
          />
          <SelectField
            label="Review Type"
            value={reviewType}
            onChange={setReviewType}
            options={["mid-year", "annual", "quarterly"]}
          />
          <Field
            label="Period"
            placeholder="01/01/2026 - 31/01/2026"
            value={period}
            onChange={setPeriod}
          />
          <SelectField
            label="Rating"
            value={rating}
            onChange={setRating}
            options={["1", "2", "3", "4", "5"]}
          />
          <TextAreaField
            label="Comments"
            value={notes}
            onChange={setNotes}
            placeholder="Add overall comments"
          />
        </div>

        <div className="flex flex-col-reverse gap-3 border-t px-4 py-4 sm:flex-row sm:justify-end sm:px-5" style={{ borderColor: "var(--border)" }}>
          <button type="button" onClick={onClose} className="h-10 rounded-lg px-4 text-sm font-semibold sm:h-auto sm:py-2" style={btnSecondary}>
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onCreate({ employeeId, employeeName, reviewType, period, rating, notes })}
            className="h-10 rounded-lg px-4 text-sm font-semibold sm:h-auto sm:py-2"
            style={btnPrimary}
          >
            {isEdit ? "Save Review" : "Create Review"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold" style={textPrimary}>
        {label}
      </span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full rounded-lg px-3 text-sm outline-none"
        style={input}
        placeholder={placeholder}
      />
    </label>
  );
}

function TextAreaField({
  label,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold" style={textPrimary}>
        {label}
      </span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg px-3 py-2 text-sm outline-none"
        style={input}
        placeholder={placeholder}
        rows={3}
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
}) {
  return (
    <ConstrainedDropdown
      label={label}
      value={value}
      onChange={onChange}
      options={options}
      buttonStyle={input}
      labelStyle={textPrimary}
    />
  );
}
