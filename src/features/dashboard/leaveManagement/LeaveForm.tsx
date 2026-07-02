import { useState } from "react";

import { applyLeave } from "./leaveService";

import toast from "react-hot-toast";


export default function LeaveForm({
  onSuccess,
}: any) {

  const token =
    localStorage.getItem("token") || "";

  const [form, setForm] = useState({
    leave_type: "",
    duration_type: "Full Day",
    leave_date: "",
    days: 1,
    reason: "",
  });

  const submitLeave = async () => {

    try {

      await applyLeave(form, token);


      toast.success(
        "Leave Applied Successfully"
      );

      onSuccess();

      setForm({
        leave_type: "",
        duration_type: "Full Day",
        leave_date: "",
        days: 1,
        reason: "",
      });

   } catch (err) {

  console.log(err);

  toast.error(
    "Failed To Apply Leave"
  );



    }
  };

  return (

    <div className="bg-white p-5 rounded-xl shadow">

      <h2 className="text-xl font-bold mb-4">
        Apply Leave
      </h2>

      <input
        className="border p-2 w-full mb-3"
        placeholder="Leave Type"
        value={form.leave_type}
        onChange={(e) =>
          setForm({
            ...form,
            leave_type: e.target.value,
          })
        }
      />

      <input
        type="date"
        className="border p-2 w-full mb-3"
        value={form.leave_date}
        onChange={(e) =>
          setForm({
            ...form,
            leave_date: e.target.value,
          })
        }
      />

      <textarea
        className="border p-2 w-full mb-3"
        placeholder="Reason"
        value={form.reason}
        onChange={(e) =>
          setForm({
            ...form,
            reason: e.target.value,
          })
        }
      />

      <button
        onClick={submitLeave}
        className="px-4 py-2 rounded"
        style={{ background: "var(--accent)", color: "var(--accent-text)", border: "none" }}
      >
        Apply Leave
      </button>

    </div>
  );
}