import { useEffect, useState } from "react";

import axios from "axios";

export default function ManagerLeavePage() {

  const token =
    localStorage.getItem("token") || "";

  const [leaves, setLeaves] = useState([]);

  useEffect(() => {

    fetchLeaves();

  }, []);

  const fetchLeaves = async () => {

    try {

      const res = await axios.get(
        "http://localhost:8000/api/leaves/manager",
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      setLeaves(res.data.data);

    } catch (err) {

      console.log(err);

    }
  };

  const updateStatus = async (
    id: string,
    status: string
  ) => {
    const comment = status === "manager_approved" ? "Approved by manager" : "Rejected by manager";

    try {

      await axios.patch(
        `http://localhost:8000/api/leaves/${id}/manager-status`,
        {
          status,
          comment,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      alert("Updated");

      fetchLeaves();

    } catch (err) {

      console.log(err);

      alert("Failed");

    }
  };

  return (

    <div className="p-6">

      <h1 className="text-2xl font-bold mb-5">
        Manager Leave Approvals
      </h1>

      <table className="w-full border">

        <thead>

          <tr className="bg-gray-100">

            <th className="border p-2">
              Employee
            </th>

            <th className="border p-2">
              Type
            </th>

            <th className="border p-2">
              Date
            </th>

            <th className="border p-2">
              Status
            </th>

            <th className="border p-2">
              Action
            </th>

          </tr>

        </thead>

        <tbody>

          {leaves.map((leave: any) => (

            <tr key={leave.id}>

              <td className="border p-2">
                {leave.employee_name}
              </td>

              <td className="border p-2">
                {leave.leave_type}
              </td>

              <td className="border p-2">
                {leave.leave_date}
              </td>

              <td className="border p-2">
                {leave.internal_status || leave.status}
              </td>

              <td className="border p-2 space-x-2">
                {leave.internal_status === "manager_pending" ? (
                  <>
                    <button
                      onClick={() =>
                        updateStatus(
                          leave.id,
                          "manager_approved"
                        )
                      }
                      className="bg-green-600 text-white px-3 py-1 rounded"
                    >
                      Approve
                    </button>

                    <button
                      onClick={() =>
                        updateStatus(
                          leave.id,
                          "manager_rejected"
                        )
                      }
                      className="bg-red-600 text-white px-3 py-1 rounded"
                    >
                      Reject
                    </button>
                  </>
                ) : (
                  <span className="text-gray-500">—</span>
                )}
              </td>

            </tr>

          ))}

        </tbody>

      </table>

    </div>
  );
}