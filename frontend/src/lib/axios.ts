import axios from "axios";
import { getApiBaseUrl } from "../config/apiConfig";

const api = axios.create({
    baseURL: getApiBaseUrl(),
    withCredentials: true,
})

export default api;
