import { useEffect, useState } from "react";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
} from "recharts";

import { getMyLeaves } from "./leaveService";

export default function LeaveAnalytics() {

  const token =
    localStorage.getItem("token") || "";

  const [data, setData] = useState([
    {
      name: "Approved",
      value: 0,
    },
    {
      name: "Rejected",
      value: 0,
    },
    {
      name: "Pending",
      value: 0,
    },
  ]);

  useEffect(() => {

    fetchAnalytics();

  }, []);

  const fetchAnalytics = async () => {

    try {

      const res =
        await getMyLeaves(token);

      const leaves =
        res.data.data;

      const approved =
        leaves.filter(
          (leave: any) =>
            leave.status === "approved"
        ).length;

      const rejected =
        leaves.filter(
          (leave: any) =>
            leave.status === "rejected"
        ).length;

      const pending =
        leaves.filter(
          (leave: any) =>
            leave.status === "pending"
        ).length;

      setData([
        {
          name: "Approved",
          value: approved,
        },
        {
          name: "Rejected",
          value: rejected,
        },
        {
          name: "Pending",
          value: pending,
        },
      ]);

    } catch (err) {

      console.log(err);

    }
  };

  const COLORS = [
    "#16a34a",
    "#dc2626",
    "#eab308",
  ];

  return (

    <div className="bg-white p-5 rounded-xl shadow mb-5">

      <h2 className="text-xl font-bold mb-4">
        Leave Analytics
      </h2>

      <PieChart width={400} height={300}>

        <Pie
          data={data}
          cx="50%"
          cy="50%"
          outerRadius={100}
          dataKey="value"
          label
        >

          {data.map((_, index) => (

            <Cell
              key={index}
              fill={COLORS[index]}
            />

          ))}

        </Pie>

        <Tooltip />

        <Legend />

      </PieChart>

    </div>
  );
}