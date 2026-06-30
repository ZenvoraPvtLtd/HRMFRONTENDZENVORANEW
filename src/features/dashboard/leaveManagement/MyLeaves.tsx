import { useEffect, useState } from "react";

import { getMyLeaves } from "./leaveService";

export default function MyLeaves({
  refresh,
}: any) {

  const token =
    localStorage.getItem("token") || "";

  const [leaves, setLeaves] =
    useState([]);

  const [filter, setFilter] =
    useState("all");

  useEffect(() => {

    fetchLeaves();

  }, [refresh]);

  const fetchLeaves = async () => {

    try {

      const res =
        await getMyLeaves(token);

      setLeaves(res.data.data);

    } catch (err) {

      console.log(err);

    }
  };
  const filteredLeaves =
    filter === "all"
      ? leaves
      : leaves.filter(
        (leave: any) =>
          leave.status === filter
      );
  return (

    <div className="bg-white p-5 rounded-xl shadow mt-5">

      <h2 className="text-xl font-bold mb-4">
        My Leaves
      </h2>
      <select
        className="border p-2 mb-4"
        value={filter}
        onChange={(e) =>
          setFilter(e.target.value)
        }
      >

        <option value="all">
          All
        </option>

        <option value="approved">
          Approved
        </option>

        <option value="rejected">
          Rejected
        </option>

        <option value="pending">
          Pending
        </option>

      </select>
      <table className="w-full border">

        <thead>

          <tr className="bg-gray-100">

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
              Days
            </th>

          </tr>

        </thead>

        <tbody>

          {filteredLeaves.map((leave: any) => (

            <tr key={leave.id}>

              <td className="p-2 border">
                {leave.leave_type}
              </td>

              <td className="p-2 border">
                {leave.leave_date}
              </td>

              <td className="p-2 border">

                <span
                  className={`px-3 py-1 rounded text-white text-sm
    ${leave.status === "approved"
                      ? "bg-green-600"
                      : leave.status === "rejected"
                        ? "bg-red-600"
                        : "bg-yellow-500"
                    }`}
                >
                  {leave.status}
                </span>

              </td>

              <td className="p-2 border">
                {leave.days}
              </td>

            </tr>

          ))}

        </tbody>

      </table>

    </div>
  );
}