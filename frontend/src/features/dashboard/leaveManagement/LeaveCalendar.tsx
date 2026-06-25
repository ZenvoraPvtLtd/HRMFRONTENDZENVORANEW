import { useEffect, useState } from "react";

import Calendar from "react-calendar";

import "react-calendar/dist/Calendar.css";

import { getMyLeaves } from "./leaveService";

export default function LeaveCalendar() {

  const token =
    localStorage.getItem("token") || "";

  const [leaves, setLeaves] =
    useState([]);

  useEffect(() => {

    fetchLeaves();

  }, []);

  const fetchLeaves = async () => {

    try {

      const res =
        await getMyLeaves(token);

      setLeaves(res.data.data);

    } catch (err) {

      console.log(err);

    }
  };

  const getTileClass = ({
    date,
  }: any) => {

    const foundLeave: any =
      leaves.find((leave: any) => {

        const leaveDate =
          new Date(
            leave.leave_date
          );

        return (
          leaveDate.toDateString() ===
          date.toDateString()
        );
      });

    if (!foundLeave) {
      return "";
    }

    if (
      foundLeave.status ===
      "approved"
    ) {
      return "bg-green-500 text-white rounded-full";
    }

    if (
      foundLeave.status ===
      "rejected"
    ) {
      return "bg-red-500 text-white rounded-full";
    }

    return "bg-yellow-400 text-black rounded-full";
  };

  return (

    <div className="bg-white p-5 rounded-xl shadow mb-5">

      <h2 className="text-xl font-bold mb-4">
        Leave Calendar
      </h2>

      <Calendar
        tileClassName={getTileClass}
      />

    </div>
  );
}