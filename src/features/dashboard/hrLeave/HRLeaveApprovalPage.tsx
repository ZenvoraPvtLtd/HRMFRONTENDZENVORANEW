import { useEffect, useState } from "react";

import axios from "axios";
import { getApiBaseUrl } from "../../../config/apiConfig";


export default function HRLeaveApprovalPage() {

  const token =
    localStorage.getItem("token") || "";

  const [leaves, setLeaves] = useState<any[]>([]);
  const [search, setSearch] =
    useState("");
  const [filter, setFilter] =
    useState("all");

  useEffect(() => {

    fetchLeaves();

  }, []);

  const fetchLeaves = async () => {

    try {

      const res = await axios.get(
        `${getApiBaseUrl()}/api/leaves`,
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

    try {

      await axios.patch(
        `${getApiBaseUrl()}/api/leaves/${id}/status`,
        {
          status,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      alert("Leave Status Updated");

      fetchLeaves();

    } catch (err) {

      console.log(err);

      alert("Failed To Update Status");

    }
  };

  return (

    <div className="p-6">

      <h1 className="text-2xl font-bold mb-5">
        HR Leave Approvals
      </h1>
      <input
        type="text"
        placeholder="Search Employee"
        value={search}
        onChange={(e) =>
          setSearch(e.target.value)
        }
        className="border p-2 mb-4 w-full rounded"
      />

      <select
        value={filter}
        onChange={(e) =>
          setFilter(e.target.value)
        }
        className="border p-2 mb-4 w-full rounded"
      >

        <option value="all">
          All
        </option>

        <option value="Under HR Review">
          Under HR Review
        </option>

        <option value="Approved">
          Approved
        </option>

        <option value="Rejected">
          Rejected
        </option>

      </select>

      <table className="w-full border">

        <thead>

          <tr>

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

          {leaves
            .filter((leave: any) => {

              const matchesSearch =
                leave.employee_name
                  ?.toLowerCase()
                  .includes(
                    search.toLowerCase()
                  );

              const matchesFilter =
                filter === "all"
                  ? true
                  : leave.status === filter;

              return (
                matchesSearch &&
                matchesFilter
              );
            })

            .map((leave: any) => (

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
                  {leave.status}
                </td>

                <td className="border p-2">
                  {((leave.internal_status === "manager_approved") || leave.status === "Under HR Review") ? (
                    <>
                      <button
                        onClick={() =>
                          updateStatus(
                            leave.id,
                            "approved"
                          )
                        }
                        className="bg-green-600 text-white px-3 py-1 rounded mr-2"
                      >
                        Approve
                      </button>

                      <button
                        onClick={() =>
                          updateStatus(
                            leave.id,
                            "rejected"
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