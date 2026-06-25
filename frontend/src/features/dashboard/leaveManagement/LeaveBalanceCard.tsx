import { useEffect, useState } from "react";

import { getMyLeaves } from "./leaveService";

export default function LeaveBalanceCard() {

  const token =
    localStorage.getItem("token") || "";

  const TOTAL_LEAVES = 20;

  const [usedLeaves, setUsedLeaves] =
    useState(0);

  useEffect(() => {

    fetchBalance();

  }, []);

  const fetchBalance = async () => {

    try {

      const res =
        await getMyLeaves(token);

      const leaves =
        res.data.data;

      const approvedLeaves =
        leaves.filter(
          (leave: any) =>
            leave.status === "approved"
        );

      const used =
        approvedLeaves.reduce(
          (
            total: number,
            leave: any
          ) => total + leave.days,
          0
        );

      setUsedLeaves(used);

    } catch (err) {

      console.log(err);

    }
  };

  return (

    <div className="grid grid-cols-3 gap-4 mb-5">

      <div className="bg-blue-100 p-5 rounded-xl">

        <h2 className="text-lg font-bold">
          Total Leaves
        </h2>

        <p className="text-3xl mt-2">
          {TOTAL_LEAVES}
        </p>

      </div>

      <div className="bg-yellow-100 p-5 rounded-xl">

        <h2 className="text-lg font-bold">
          Used Leaves
        </h2>

        <p className="text-3xl mt-2">
          {usedLeaves}
        </p>

      </div>

      <div className="bg-green-100 p-5 rounded-xl">

        <h2 className="text-lg font-bold">
          Remaining
        </h2>

        <p className="text-3xl mt-2">
          {TOTAL_LEAVES - usedLeaves}
        </p>

      </div>

    </div>
  );
}