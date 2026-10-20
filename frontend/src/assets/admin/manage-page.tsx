import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  FaUsers,
  FaBoxOpen,
  FaChartLine,
  FaHome,
  FaSignOutAlt,
  FaBars,
  FaRegStar,
  FaBoxes,
  FaShoppingBag,
} from "react-icons/fa";
import { useEffect, useState } from "react";
import { showError } from "@/common/toast";

// Chỉ render giao diện/gọi API quản trị khi đã đăng nhập VÀ role là admin.
// Trước đây route /manage-page/* không kiểm tra gì cả, nên ai gõ thẳng URL
// cũng thấy được khung trang admin (dù API bên trong đã bị BE chặn).
const isAdminLoggedIn = (): boolean => {
  const token = localStorage.getItem("token");
  const rawUser = localStorage.getItem("user");
  if (!token || !rawUser) return false;
  try {
    const user = JSON.parse(rawUser);
    return user?.role === "admin";
  } catch {
    return false;
  }
};

export default function AdminLayout() {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const authorized = isAdminLoggedIn();

  useEffect(() => {
    if (!authorized) {
      showError("Bạn cần đăng nhập tài khoản admin để truy cập trang này!");
      navigate("/login", { replace: true });
    }
  }, [authorized, navigate]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
  };

  if (!authorized) return null;

  return (
    <div className="flex min-h-screen bg-gray-100 relative">
      {/* 🔹 Overlay (chỉ mobile) */}
      <button
        className="md:hidden fixed top-6 left-4 p-2 bg-green-700 text-white rounded-lg shadow-md"
        onClick={() => setIsOpen(!isOpen)}
      >
        <FaBars size={20} />
      </button>

      {/* 🔹 SIDEBAR */}
      <aside
        className={`fixed top-0 left-0 h-full w-64 bg-green-700 text-white flex flex-col z-40 transform transition-transform duration-300
  ${isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`}
      >
        <div className="p-4 text-2xl font-bold border-b border-green-500 text-center relative">
          Admin Page
        </div>

        {/* Navigation */}
        <nav className="flex-1 mt-4 overflow-y-auto">
          <NavLink
            to="account-manage"
            className={({ isActive }) =>
              `flex items-center gap-3 px-6 py-3 text-base hover:bg-green-600 transition ${
                isActive ? "bg-green-600 font-semibold" : ""
              }`
            }
            onClick={() => setIsOpen(false)}
          >
            <FaUsers /> Quản lý tài khoản
          </NavLink>

          <NavLink
            to="products-manage"
            className={({ isActive }) =>
              `flex items-center gap-3 px-6 py-3 text-base hover:bg-green-600 transition ${
                isActive ? "bg-green-600 font-semibold" : ""
              }`
            }
            onClick={() => setIsOpen(false)}
          >
            <FaBoxOpen /> Quản lý sản phẩm
          </NavLink>
          <NavLink
            to="order-manage"
            className={({ isActive }) =>
              `flex items-center gap-3 px-6 py-3 text-base hover:bg-green-600 transition ${
                isActive ? "bg-green-600 font-semibold" : ""
              }`
            }
            onClick={() => setIsOpen(false)}
          >
            <FaBoxes /> Quản lý đơn hàng
          </NavLink>

          <NavLink
            to="feedback-manage"
            className={({ isActive }) =>
              `flex items-center gap-3 px-6 py-3 text-base hover:bg-green-600 transition ${
                isActive ? "bg-green-600 font-semibold" : ""
              }`
            }
            onClick={() => setIsOpen(false)}
          >
            <FaRegStar /> Quản lý bài đánh giá
          </NavLink>

          <NavLink
            to="statistics"
            className={({ isActive }) =>
              `flex items-center gap-3 px-6 py-3 text-base hover:bg-green-600 transition ${
                isActive ? "bg-green-600 font-semibold" : ""
              }`
            }
            onClick={() => setIsOpen(false)}
          >
            <FaChartLine /> Thống kê
          </NavLink>
        </nav>

        <div className="border-t border-green-500">
          <button
            onClick={() => {
              setIsOpen(false);
              navigate("/");
            }}
            className="flex items-center gap-3 px-6 py-3 w-full text-left hover:bg-green-600 transition"
          >
            <FaShoppingBag /> Về trang chủ mua sắm
          </button>

          <button
            onClick={() => {
              setIsOpen(false);
              navigate(-1);
            }}
            className="flex items-center gap-3 px-6 py-3 w-full text-left hover:bg-green-600 transition"
          >
            <FaHome /> Quay lại trang trước
          </button>

          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-6 py-3 w-full text-left hover:bg-green-600 transition"
          >
            <FaSignOutAlt /> Đăng xuất
          </button>
        </div>
      </aside>

      {/* 🔹 CONTENT */}
      <main className="flex-1 p-0 sm:p-6 overflow-y-auto ml-0 md:ml-64">
        <Outlet />
      </main>

      {/* 🔹 Overlay (chỉ mobile) */}
      {isOpen && (
        <div
          className={`fixed inset-0 bg-black/20 z-30 md:hidden transition-opacity duration-300`}
          style={{ opacity: isOpen ? 1 : 0 }}
          onClick={() => setIsOpen(false)}
        ></div>
      )}
    </div>
  );
}
