// Gọi API cập nhật, thêm SĐT, địa chỉ khách hàng

import axios from "axios";
import type { UpdateUserResponse, User } from "@/types/update-user.type";

const API_URL = import.meta.env.VITE_API_URL;
const UPDATE_ENDPOINT = `${API_URL}/auth/users`;

export const updateUser = async (
  userId: string,
  data: Partial<User> // gửi chỉ 1 phần user
): Promise<UpdateUserResponse> => {
  // Token giờ nằm trong cookie httpOnly do BE set lúc đăng nhập - trình duyệt tự
  // đính kèm (withCredentials: true), không cần tự đọc/gắn token nữa.
  try {
    const response = await axios.put<UpdateUserResponse>(
      `${UPDATE_ENDPOINT}/${userId}`,
      data,
      {
        headers: { "Content-Type": "application/json" },
        withCredentials: true,
      }
    );

    if (response.status === 200) {
      return response.data;
    } else {
      throw new Error(response.data?.message || "Cập nhật thất bại");
    }
  } catch (error: any) {
    if (error.response?.status === 401) {
      localStorage.removeItem("user");
      throw new Error("Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.");
    }
    throw new Error(error.response?.data?.message || error.message);
  }
};

export default updateUser;
