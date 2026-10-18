import { useEffect, useState } from "react";
import { userApi } from "@/api/user-by-admin";
import type { User, CreateUserInput } from "@/types/update-user.type";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/table";
import { Button } from "@/components/button";
import { FaPlus, FaUser, FaUserShield } from "react-icons/fa";
import avt from "@/assets/images/default.jpg";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/dialog";
import { Input } from "@/components/input";
import { showSuccess, showError } from "@/common/toast";

// ✅ import API địa chỉ
import { getProvinces, getWards } from "@/api/address";

export default function AdminUsers() {
  const [users, setUsers] = useState<User[]>([]);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [creatingUser, setCreatingUser] = useState<boolean>(false);
  const [formData, setFormData] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [TinhThanhCode, setTinhThanhCode] = useState<string>("");

  // ✅ State cho địa chỉ
  const [provinces, setProvinces] = useState<any[]>([]);

  const [wards, setWards] = useState<any[]>([]);

  useEffect(() => {
    async function fetchData() {
      try {
        const usersData = await userApi.getAll();
        setUsers(usersData);
      } catch (error: any) {
        // Nếu lỗi là do token, axiosInstance đã tự xử lý, nên không show thêm
        const msg = error.response?.data?.message || error.message || "";
        if (
          msg.includes("Token") ||
          msg.includes("Phiên đăng nhập") ||
          msg.includes("Unauthorized")
        ) {
          // Bỏ qua, đã handled ở axiosInstance
          return;
        }
        showError("Không thể tải danh sách người dùng!");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
    getProvinces().then(setProvinces);
  }, []);

  const handleDelete = (user: User) => {
    setUserToDelete(user);
  };

  const confirmDelete = async () => {
    if (!userToDelete) return;
    if (userToDelete.role === "admin") {
      showError("Không thể xóa tài khoản quản trị viên (admin)!");
      setUserToDelete(null);
      return;
    }

    try {
      const numericId = Number(userToDelete.id);
      await userApi.remove(numericId);
      setUsers((prev) => prev.filter((u) => Number(u.id) !== numericId));
      showSuccess("Xóa tài khoản thành công!");
    } catch (error) {
      showError("Xóa thất bại!");
    } finally {
      setUserToDelete(null);
    }
  };

  const handleCreate = () => {
    setCreatingUser(true);
    setFormData({
      fullname: "",
      username: "",
      email: "",
      SoDienThoai: "",
      TinhThanh: "",

      PhuongXa: "",
      DiaChiChiTiet: "",
      avatar: "",
      password: "",
      role: "user",
    });
  };

  const openEditModal = async (user: User) => {
    setEditingUser(user);
    setFormData({
      fullname: user.fullname || "",
      username: user.username || "",
      email: user.email || "",
      SoDienThoai: user.SoDienThoai || "",
      TinhThanh: user.TinhThanh || "",
      PhuongXa: user.PhuongXa || "",
      DiaChiChiTiet: user.DiaChiChiTiet || "",
      avatar: user.avatar || "",
      role: user.role || "user",
    });

    // ĐẢM BẢO provinces đã có dữ liệu
    let provincesList = provinces;
    if (provincesList.length === 0) {
      console.log("Tỉnh chưa load, đang load lại...");
      provincesList = await getProvinces();
      setProvinces(provincesList);
    }

    // Tìm tỉnh và set code để useEffect load phường/xã
    if (user.TinhThanh) {
      const province = provincesList.find(
        (p) => p.name === user.TinhThanh || p.name_with_type === user.TinhThanh
      );

      if (province) {
        const code = province.code || province.id || province.idProvince;
        console.log("Tìm thấy tỉnh → set code:", code);
        setTinhThanhCode(code.toString());
      } else {
        console.warn("Không tìm thấy tỉnh:", user.TinhThanh);
        setTinhThanhCode("");
        setWards([]);
      }
    } else {
      setTinhThanhCode("");
      setWards([]);
    }
  };

  const handleCloseModal = () => {
    setEditingUser(null);
    setCreatingUser(false);
    setFormData({});

    setWards([]);
  };

  const handleSave = async () => {
    if (!editingUser) return;
    try {
      const cleanData = {
        fullname: formData.fullname || "",
        username: formData.username || "",
        email: formData.email || "",
        SoDienThoai: formData.SoDienThoai || "",
        TinhThanh: formData.TinhThanh || "",

        PhuongXa: formData.PhuongXa || "",
        DiaChiChiTiet: formData.DiaChiChiTiet || "",
        avatar: formData.avatar || "",
        role: formData.role || editingUser.role,
        ...(formData.newPassword
          ? { password: formData.newPassword }
          : {}),
      };

      console.log("📦 Dữ liệu gửi lên (cập nhật):", cleanData);
      const res = await userApi.update(Number(editingUser.id), cleanData);
      showSuccess(res.message || "Cập nhật thành công!");

      const updatedList = await userApi.getAll();
      setUsers(updatedList);
      handleCloseModal();
    } catch (error: any) {
      console.error("Lỗi cập nhật:", error);
      const msg = error.response?.data?.message || error.message;
      showError(msg ? `Cập nhật thất bại: ${msg}` : "Cập nhật thất bại!");
    }
  };

  const handleCreateUser = async () => {
    try {
      const cleanData: CreateUserInput = {
        fullname: formData.fullname || "",
        username: formData.username || "",
        email: formData.email || "",
        SoDienThoai: formData.SoDienThoai || "",
        TinhThanh: formData.TinhThanh || "",

        PhuongXa: formData.PhuongXa || "",
        DiaChiChiTiet: formData.DiaChiChiTiet || "",
        avatar: formData.avatar || "",
        password: formData.password || "",
        role: formData.role || "user",
      };

      console.log("📦 Dữ liệu gửi lên (tạo tài khoản):", cleanData);
      const res = await userApi.create(cleanData);
      showSuccess(res.message || "Tạo tài khoản thành công!");

      const updatedList = await userApi.getAll();
      setUsers(updatedList);
      handleCloseModal();
    } catch (error: any) {
      console.error("Lỗi tạo tài khoản:", error);
      const msg = error.response?.data?.message || error.message;
      showError(msg ? `Tạo tài khoản thất bại: ${msg}` : "Tạo tài khoản thất bại!");
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // ✅ Xử lý chọn địa chỉ
  const handleProvinceChange = async (
    e: React.ChangeEvent<HTMLSelectElement>
  ) => {
    const provinceName = e.target.value;
    const province = provinces.find(
      (p) => p.name === provinceName || p.name_with_type === provinceName
    );

    setFormData({
      ...formData,
      TinhThanh: provinceName,
      PhuongXa: "",
    });

    if (province) {
      const code = province.code || province.id || province.idProvince;
      setTinhThanhCode(code.toString());
      // getWards sẽ tự chạy nhờ useEffect
    } else {
      setTinhThanhCode("");
      setWards([]);
    }
  };

  // TỰ ĐỘNG LOAD PHƯỜNG/XÃ KHI CÓ TỈNH
  useEffect(() => {
    if (TinhThanhCode) {
      console.log("Đang load phường/xã cho code:", TinhThanhCode);
      getWards(TinhThanhCode)
        .then((data) => {
          setWards(Array.isArray(data) ? data : []);
        })
        .catch((err) => {
          console.error("Lỗi load phường/xã:", err);
          setWards([]);
        });
    } else {
      setWards([]);
    }
  }, [TinhThanhCode]);

  const handleWardChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setFormData({ ...formData, PhuongXa: e.target.value });
  };

  const adminAccounts = users.filter((u) => u.role === "admin");
  const userAccounts = users.filter((u) => u.role === "user");

  if (loading) {
    return <div className="text-center py-10">Đang tải dữ liệu...</div>;
  }

  return (
    <div>
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-6 px-3 sm:px-0 mt-6">
        <h2 className="text-3xl sm:text-4xl font-extrabold text-green-700 text-center sm:text-left w-full mb-6 sm:mb-0">
          Quản lý tài khoản
        </h2>

        <Button
          onClick={handleCreate}
          className="flex items-center gap-2 bg-green-500 hover:bg-green-700 text-white"
        >
          <FaPlus /> Tạo tài khoản
        </Button>
      </div>

      {/* TABLE */}
      <div className="w-full bg-white sm:rounded-xl sm:shadow sm:p-4 p-0 rounded-none shadow-none sm:mx-4 mx-0 sm:w-auto">
        <div className="overflow-x-auto sm:overflow-x-visible">
          <Table className="min-w-full border-collapse">
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Username</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Họ tên</TableHead>
                <TableHead>Số điện thoại</TableHead>
                <TableHead>Địa chỉ</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Avatar</TableHead>
                <TableHead>Ngày tạo</TableHead>
                <TableHead className="text-right">Hành động</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell
                  colSpan={10}
                  className="font-semibold text-green-700 bg-green-50"
                >
                  <div className="flex items-center gap-2">
                    <FaUserShield className="text-red-500" />
                    Tài khoản quản trị (Admin)
                  </div>
                </TableCell>
              </TableRow>

              {adminAccounts.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>{user.id}</TableCell>
                  <TableCell>{user.username}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>{user.fullname}</TableCell>
                  <TableCell>{user.SoDienThoai || "-"}</TableCell>
                  <TableCell>{user.TinhThanh || "-"}</TableCell>
                  <TableCell>{user.role}</TableCell>
                  <TableCell>
                    {user.avatar ? (
                      <img
                        src={
                          user.avatar
                            ? `${import.meta.env.VITE_BASE_SERVER}${
                                user.avatar
                              }`
                            : avt
                        }
                        alt="avatar"
                        className="w-8 h-8 rounded-full"
                      />
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell>
                    {new Date(user.created_at).toLocaleDateString("vi-VN")}
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEditModal(user)}
                    >
                      Cập nhật
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDelete(user)}
                      className="bg-red-600 hover:bg-red-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={user.role === "admin"} // ✅ Không cho xóa tài khoản admin
                    >
                      Xóa
                    </Button>
                  </TableCell>
                </TableRow>
              ))}

              <TableRow>
                <TableCell
                  colSpan={10}
                  className="font-semibold text-blue-700 bg-blue-50"
                >
                  <div className="flex items-center gap-2">
                    <FaUser className="text-blue-500" /> Tài khoản người dùng
                    (User)
                  </div>
                </TableCell>
              </TableRow>

              {userAccounts.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>{user.id}</TableCell>
                  <TableCell>{user.username}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>{user.fullname}</TableCell>
                  <TableCell>{user.SoDienThoai || "-"}</TableCell>
                  <TableCell>{user.TinhThanh || "-"}</TableCell>
                  <TableCell>{user.role}</TableCell>
                  <TableCell>
                    {user.avatar ? (
                      <img
                        src={
                          user.avatar
                            ? `${import.meta.env.VITE_BASE_SERVER}${
                                user.avatar
                              }`
                            : avt
                        }
                        alt="avatar"
                        className="w-8 h-8 rounded-full"
                      />
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell>
                    {new Date(user.created_at).toLocaleDateString("vi-VN")}
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEditModal(user)}
                    >
                      Cập nhật
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDelete(user)}
                      className="bg-red-600 hover:bg-red-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={user.role === "admin"} // ✅ Không cho xóa tài khoản admin
                    >
                      Xóa
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* MODAL */}
        <Dialog
          open={!!editingUser || creatingUser}
          onOpenChange={handleCloseModal}
        >
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {creatingUser ? "Tạo tài khoản mới" : "Cập nhật tài khoản"}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-3">
              <Input
                name="fullname"
                value={formData.fullname || ""}
                onChange={handleChange}
                placeholder="Họ và tên"
              />
              <Input
                name="username"
                value={formData.username || ""}
                onChange={handleChange}
                disabled={!!editingUser}
                placeholder="Tên đăng nhập"
              />
              <Input
                name="email"
                value={formData.email || ""}
                onChange={handleChange}
                placeholder="Email"
              />

              {creatingUser && (
                <Input
                  name="password"
                  type="password"
                  value={formData.password || ""}
                  onChange={handleChange}
                  placeholder="Mật khẩu"
                />
              )}

              {!creatingUser && (
                <Input
                  name="newPassword"
                  type="password"
                  value={formData.newPassword || ""}
                  onChange={handleChange}
                  placeholder="Mật khẩu mới (để trống nếu không đổi)"
                />
              )}

              <Input
                name="SoDienThoai"
                value={formData.SoDienThoai || ""}
                onChange={handleChange}
                placeholder="Số điện thoại"
              />

              {/* ✅ Phần chọn địa chỉ */}
              <select
                name="TinhThanh"
                value={formData.TinhThanh || ""}
                onChange={handleProvinceChange}
                className="border rounded-lg w-full p-2"
              >
                <option value="">-- Chọn tỉnh/thành --</option>
                {provinces.map((p) => (
                  <option key={p.code} value={p.name}>
                    {p.name}
                  </option>
                ))}
              </select>

              <select
                name="PhuongXa"
                value={formData.PhuongXa || ""}
                onChange={handleWardChange}
                className="border rounded-lg w-full p-2"
                disabled={!formData.TinhThanh}
              >
                <option value="">-- Chọn phường/xã --</option>
                {wards.map((w) => (
                  <option key={w.code} value={w.name}>
                    {w.name}
                  </option>
                ))}
              </select>

              <Input
                name="DiaChiChiTiet"
                value={formData.DiaChiChiTiet || ""}
                onChange={handleChange}
                placeholder="Địa chỉ chi tiết (số nhà, ngõ...)"
              />

              <select
                name="role"
                value={formData.role || "user"}
                onChange={handleChange}
                className="border rounded-lg w-full p-2"
              >
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            <div className="flex justify-between mt-5">
              <Button variant="outline" onClick={handleCloseModal}>
                Hủy
              </Button>
              <div className="flex gap-2">
                <Button onClick={creatingUser ? handleCreateUser : handleSave}>
                  {creatingUser ? "Tạo tài khoản" : "Lưu thay đổi"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
        {/* HỘP THOẠI XÁC NHẬN XÓA */}
        <Dialog
          open={!!userToDelete}
          onOpenChange={() => setUserToDelete(null)}
        >
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Xác nhận xóa tài khoản</DialogTitle>
            </DialogHeader>

            <p className="text-gray-600">
              Bạn có chắc muốn xóa tài khoản{" "}
              <span className="font-semibold text-red-600">
                {userToDelete?.username}
              </span>
              ? Hành động này không thể hoàn tác.
            </p>

            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" onClick={() => setUserToDelete(null)}>
                Hủy
              </Button>
              <Button
                variant="destructive"
                onClick={confirmDelete}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                Xóa
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
