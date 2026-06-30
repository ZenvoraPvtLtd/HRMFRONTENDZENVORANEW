import axios from "axios";
import { getApiBaseUrl } from "../../../config/apiConfig";

const API = import.meta.env.VITE_API_URL || `${getApiBaseUrl()}/api/leaves`;

export const applyLeave = async (
  data: any,
  token: string
) => {

  return axios.post(
    `${API}/`,
    data,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
};

export const getMyLeaves = async (
  token: string
) => {

  return axios.get(
    `${API}/my`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
};