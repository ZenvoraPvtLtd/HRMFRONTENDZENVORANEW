import { useEffect, useState } from "react";

import axios from "axios";

export default function ManagerLeaveApprovals() {

  const token =
    localStorage.getItem("token") || "";

  const [leaves, setLeaves] =
    useState([]);

  useEffect(() => {

    fetchLeaves();

  }, []);

  const fetchLeaves = async () => {

    try {

      const res = await axios.get(
        "http://127.0.0.1:8000/api/leaves/manager",
        {
          headers: {
            Authorization:
              `Bearer ${token}`,
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
        `http://127.0.0.1:8000/api/leaves/${id}/manager-status`,
        {
          status: status,
          comment,
        },
        {
          headers: {
            Authorization:
              `Bearer ${token}`,
          },
        }
      );

      fetchLeaves();

    } catch (err) {

      console.log(err);

    }
  };

  return (

    <div className="bg-white p-5 rounded-xl shadow">

      <h2 className="text-2xl font-bold mb-5">
        Manager Leave Approvals
      </h2>

      <table className="w-full border">

        <thead>

          <tr className="bg-gray-100">

            <th className="p-2 border">
              Employee
            </th>

            <th className="p-2 border">
              Type
            </th>

            <th className="p-2 border">
              Date
            </th>

            <th className="p-2 border">
              Status
            </th>

            <th className="p-2 border">
              Action
            </th>

          </tr>

        </thead>

        <tbody>

          {leaves.map((leave: any) => (

            <tr key={leave.id}>

              <td className="p-2 border">
                {leave.employee_name}
              </td>

              <td className="p-2 border">
                {leave.leave_type}
              </td>

              <td className="p-2 border">
                {leave.leave_date}
              </td>

              <td className="p-2 border">
                {leave.manager_status || leave.internal_status || leave.status}
              </td>

              <td className="p-2 border space-x-2">
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