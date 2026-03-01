import axios from 'axios';
import { Platform } from 'react-native';

const LOCAL_IP = '192.168.68.113'; 
const VERCEL_URL = ''; 

const getBaseURL = () => {
    if (__DEV__) {
        return `http://${LOCAL_IP}:5001`;
    }
    return VERCEL_URL || `http://${LOCAL_IP}:5001`;
};

const api = axios.create({
    baseURL: getBaseURL(),
    timeout: 15000,
    headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
    }
});

// Add a request interceptor to log requests for debugging
api.interceptors.request.use(config => {
    console.log(`[API Request] ${config.method?.toUpperCase()} ${config.url}`);
    return config;
}, error => {
    return Promise.reject(error);
});

export default api;
