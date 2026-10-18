import { useState, useRef, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { createPortal } from "react-dom";
import { FaChevronDown, FaShoppingCart } from "react-icons/fa";
import { Button } from "@/components/button";
import { getAllSanPham } from "@/api/product";
import { getProfile } from "@/api/get-profile";
import { addProductToCart } from "@/api/order-detail"; // ← THÊM API THẬT
import type { SanPham, Product } from "@/types/product.type";
import { showSuccess, showError } from "@/common/toast";
import BaMien from "@/assets/images/images-home/bamien.jpg";

const Products = () => {
  const [selectedRegion, setSelectedRegion] = useState("Tất cả");
  const [openRegion, setOpenRegion] = useState<string | null>(null);
  const [subCategory, setSubCategory] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState<string | null>(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<{ id: number } | null>(null); // ← LẤY TỪ API
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef<{ [key: string]: HTMLButtonElement | null }>({});
  const [isSticky, setIsSticky] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(30);
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchKeyword, setSearchKeyword] = useState(
    searchParams.get("search") ?? ""
  );
  const [sortBy, setSortBy] = useState<
    "featured" | "price-asc" | "price-desc" | "name-asc" | "best-seller"
  >("featured");
  const [priceFilter, setPriceFilter] = useState<
    "all" | "under-100" | "100-200" | "200-500" | "over-500"
  >("all");
  const [ratingFilter, setRatingFilter] = useState<
    "all" | "4.5" | "4.0" | "3.5"
  >("all");
  const [showInStockOnly, setShowInStockOnly] = useState(false);
  const [bestSellerOnly, setBestSellerOnly] = useState(false);
  const navigate = useNavigate();

  const regions = [
    { name: "Bắc", sub: ["Tại chỗ", "Đồ khô"], apiValue: "bac" },
    { name: "Trung", sub: ["Tại chỗ", "Đồ khô"], apiValue: "trung" },
    { name: "Nam", sub: ["Tại chỗ", "Đồ khô"], apiValue: "nam" },
  ];

  // Lấy thông tin user từ API (JWT)
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const profile = await getProfile();
        setUser({ id: profile.id });
      } catch (err) {
        setUser(null);
      }
    };
    fetchUser();
  }, []);

  // Lấy sản phẩm
  useEffect(() => {
    const fetchProducts = async () => {
      setLoading(true);
      setError(null);
      try {
        const regionApiValue =
          selectedRegion === "Tất cả"
            ? undefined
            : regions.find((r) => r.name === selectedRegion)?.apiValue;
        const subCategoryApiValue =
          subCategory === "Tại chỗ"
            ? "Tại chỗ"
            : subCategory === "Đồ khô"
            ? "Đồ khô"
            : undefined;
        const data = await getAllSanPham(regionApiValue, subCategoryApiValue);
        const formattedProducts: Product[] = data.map((item: SanPham) => {
          const giaSauVoucher = item.Voucher
            ? item.GiaBan * (1 - parseFloat(item.Voucher) / 100)
            : item.GiaBan;

          return {
            id: item.MaSP || 0,
            name: item.TenSP,
            image: item.HinhAnh || "/img-produce/default.jpg",
            region: item.VungMien || "bac",
            type: item.LoaiDoAn || "Đồ khô",
            price: giaSauVoucher,
            voucher: item.Voucher || "",
            soLuongTon: item.SoLuongTon ?? 0,
            daBan: item.DaBan ?? 0,
          };
        });

        setProducts(formattedProducts);
      } catch (err) {
        setError("Không thể tải sản phẩm, xin thử lại sau!");
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, [selectedRegion, subCategory]);

  // Responsive itemsPerPage
  useEffect(() => {
    const updateItemsPerPage = () => {
      setItemsPerPage(window.innerWidth < 768 ? 20 : 30);
    };
    updateItemsPerPage();
    window.addEventListener("resize", updateItemsPerPage);
    return () => window.removeEventListener("resize", updateItemsPerPage);
  }, []);

  // Đóng dropdown khi click ngoài
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setMobileOpen(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Cập nhật vị trí dropdown
  useEffect(() => {
    const updatePosition = () => {
      if (mobileOpen && buttonRefs.current[mobileOpen]) {
        const button = buttonRefs.current[mobileOpen];
        const rect = button.getBoundingClientRect();
        setDropdownPosition({
          top: rect.bottom + window.scrollY,
          left: Math.min(rect.left, window.innerWidth - 160),
        });
      }
    };

    const handleScroll = () => setMobileOpen(null);
    window.addEventListener("scroll", updatePosition);
    window.addEventListener("scroll", handleScroll);
    window.addEventListener("resize", updatePosition);
    updatePosition();

    return () => {
      window.removeEventListener("scroll", updatePosition);
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", updatePosition);
    };
  }, [mobileOpen]);

  // Sticky sidebar
  useEffect(() => {
    const handleScroll = () => setIsSticky(window.scrollY > 100);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const nextSearch = searchParams.get("search") ?? "";
    setSearchKeyword(nextSearch);
  }, [searchParams]);

  const handleSearchChange = (value: string) => {
    const trimmed = value.trim();
    setSearchKeyword(value);

    const nextParams = new URLSearchParams(searchParams);
    if (trimmed) {
      nextParams.set("search", trimmed);
    } else {
      nextParams.delete("search");
    }
    setSearchParams(nextParams, { replace: true });
  };

  const filteredProducts = products.filter((product) => {
    const normalizedQuery = searchKeyword.trim().toLowerCase();
    const matchesSearch =
      !normalizedQuery ||
      product.name.toLowerCase().includes(normalizedQuery) ||
      product.region.toLowerCase().includes(normalizedQuery) ||
      product.type.toLowerCase().includes(normalizedQuery);

    const matchesPrice =
      priceFilter === "all" ||
      (priceFilter === "under-100" && product.price < 100000) ||
      (priceFilter === "100-200" &&
        product.price >= 100000 &&
        product.price <= 200000) ||
      (priceFilter === "200-500" &&
        product.price > 200000 &&
        product.price <= 500000) ||
      (priceFilter === "over-500" && product.price > 500000);

    const productRating = 4.5 + ((product.daBan ?? 0) % 5) * 0.1;
    const matchesRating =
      ratingFilter === "all" ||
      (ratingFilter === "4.5" && productRating >= 4.5) ||
      (ratingFilter === "4.0" && productRating >= 4.0 && productRating < 4.5) ||
      (ratingFilter === "3.5" && productRating >= 3.5 && productRating < 4.0);

    const matchesStock = !showInStockOnly || (product.soLuongTon ?? 0) > 0;
    const matchesBestSeller = !bestSellerOnly || (product.daBan ?? 0) > 0;

    return (
      matchesSearch &&
      matchesPrice &&
      matchesRating &&
      matchesStock &&
      matchesBestSeller
    );
  });

  const sortedProducts = [...filteredProducts].sort((a, b) => {
    switch (sortBy) {
      case "price-asc":
        return a.price - b.price;
      case "price-desc":
        return b.price - a.price;
      case "name-asc":
        return a.name.localeCompare(b.name);
      case "best-seller":
        return (b.daBan ?? 0) - (a.daBan ?? 0);
      default:
        return 0;
    }
  });

  // Phân trang
  const totalItems = sortedProducts.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentProducts = sortedProducts.slice(startIndex, endIndex);

  useEffect(
    () => setCurrentPage(1),
    [selectedRegion, subCategory, searchKeyword, sortBy, priceFilter, ratingFilter, showInStockOnly, bestSellerOnly]
  );

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  // THÊM VÀO GIỎ HÀNG THẬT
  const handleAddToCart = async (product: Product) => {
    if (!user?.id) {
      showError("Vui lòng đăng nhập để thêm vào giỏ hàng!");
      navigate("/login");
      return;
    }

    if ((product.soLuongTon ?? 0) <= 0) {
      showError("Sản phẩm đã hết hàng!");
      return;
    }

    try {
      await addProductToCart({
        MaSP: product.id,
        SoLuong: 1,
        GiaBanTaiThoiDiem: product.price,
        GhiChu: "",
      });

      showSuccess(`Đã thêm "${product.name}" vào giỏ hàng!`);
    } catch (error: any) {
      const msg = error.response?.data?.message || "Không thể thêm vào giỏ!";
      showError(msg);
    }
  };

  const getImageUrl = (hinhAnh: string | undefined) => {
    if (!hinhAnh) return "/img-produce/default.jpg";
    if (hinhAnh.startsWith("http")) return hinhAnh;
    if (
      hinhAnh.startsWith("/img-produce") ||
      hinhAnh.startsWith("/img-introduce")
    )
      return hinhAnh;

    const baseUrl =
      import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";
    return `${baseUrl}${hinhAnh}`;
  };

  return (
    <div className="min-h-screen pt-20 relative isolate" ref={dropdownRef}>
      {/* Ảnh nền quảng bá vùng miền, làm mờ để không che nội dung */}
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <img
          src={BaMien}
          alt="Ẩm thực vùng miền"
          className="w-full h-full object-cover scale-110 blur-md"
        />
        <div className="absolute inset-0 bg-white/80" />
      </div>

      {loading && (
        <p className="text-center text-gray-500 mt-8">
          Đang tải sản phẩm... (⁠*⁠´⁠ω⁠｀⁠*⁠) :33333
        </p>
      )}
      {error && <p className="text-center text-red-500 mt-8">{error}</p>}

      {/* SIDEBAR - desktop */}
      <div
        className={`hidden md:block w-1/4 h-[calc(100vh-5rem)] p-5 fixed left-0 overflow-y-auto transition-all duration-300 ${
          isSticky ? "top-8" : "top-20"
        }`}
      >
        <h2 className="text-xl font-semibold mb-4">Danh mục sản phẩm</h2>

        <button
          onClick={() => {
            setSelectedRegion("Tất cả");
            setSubCategory(null);
            setOpenRegion(null);
          }}
          className={`block w-full text-left px-4 py-2 mb-2 rounded-md transition ${
            selectedRegion === "Tất cả"
              ? "bg-slate-700 text-white"
              : "text-gray-700 hover:bg-gray-100"
          }`}
        >
          Tất cả sản phẩm
        </button>

        {regions.map((r) => (
          <div key={r.name} className="mb-2">
            <button
              onClick={() =>
                setOpenRegion(openRegion === r.name ? null : r.name)
              }
              className={`flex justify-between items-center w-full text-left px-4 py-2 rounded-md transition ${
                selectedRegion === r.name
                  ? "bg-slate-700 text-white"
                  : "text-gray-700 hover:bg-gray-100"
              }`}
            >
              <span>Đặc sản miền {r.name}</span>
              <FaChevronDown
                size={14}
                className={`transform transition-transform duration-300 ${
                  openRegion === r.name ? "rotate-180" : ""
                }`}
              />
            </button>

            {openRegion === r.name && (
              <div className="ml-6 mt-1">
                {r.sub.map((type) => (
                  <button
                    key={type}
                    onClick={() => {
                      setSelectedRegion(r.name);
                      setSubCategory(type);
                    }}
                    className={`block w-full text-left px-3 py-1 rounded-md mb-1 transition ${
                      subCategory === type && selectedRegion === r.name
                        ? "bg-slate-600 text-white"
                        : "text-gray-600 hover:bg-gray-100"
                    }`}
                  >
                    {type === "Tại chỗ"
                      ? "Sản phẩm sử dụng tại chỗ"
                      : "Sản phẩm khô (mang đi xa)"}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* NAVBAR - mobile */}
      <div className="flex md:hidden absolute top-20 left-0 right-0 bg-white shadow-sm px-3 py-3 justify-center gap-8 z-20 overflow-x-auto">
        <button
          onClick={() => {
            setSelectedRegion("Tất cả");
            setSubCategory(null);
            setMobileOpen(null);
          }}
          className={`font-medium ${
            selectedRegion === "Tất cả"
              ? "text-orange-600"
              : "hover:text-orange-600"
          }`}
        >
          Tất cả
        </button>

        {regions.map((r) => (
          <div key={r.name} className="flex-shrink-0">
            <button
              ref={(el) => {
                buttonRefs.current[r.name] = el;
              }}
              onClick={() =>
                setMobileOpen(mobileOpen === r.name ? null : r.name)
              }
              className={`flex items-center gap-1 font-medium ${
                selectedRegion === r.name
                  ? "text-orange-600"
                  : "hover:text-orange-600"
              }`}
            >
              {r.name}
              <FaChevronDown
                size={12}
                className={`transform transition-transform duration-300 ${
                  mobileOpen === r.name ? "rotate-180" : ""
                }`}
              />
            </button>
          </div>
        ))}
      </div>

      {/* Dropdown mobile */}
      {mobileOpen &&
        createPortal(
          <div
            className="md:hidden absolute w-40 max-h-60 overflow-y-auto bg-white rounded-lg shadow-md z-20"
            style={{ top: dropdownPosition.top, left: dropdownPosition.left }}
            ref={dropdownRef}
          >
            {regions
              .find((r) => r.name === mobileOpen)
              ?.sub.map((type) => (
                <button
                  key={type}
                  onClick={() => {
                    setSelectedRegion(mobileOpen);
                    setSubCategory(type);
                    setMobileOpen(null);
                  }}
                  className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-100"
                >
                  {type === "Tại chỗ" ? "Sản phẩm tại chỗ" : "Sản phẩm khô"}
                </button>
              ))}
          </div>,
          document.body
        )}

      {/* MAIN CONTENT */}
      <div className="flex-1 px-2 md:px-4 py-6 md:ml-[25%] mt-8 md:-mt-2">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
          <div>
            <h2 className="text-2xl font-semibold">
              {selectedRegion === "Tất cả"
                ? "Tất cả sản phẩm"
                : subCategory
                ? `Đặc sản miền ${selectedRegion} - ${subCategory}`
                : `Đặc sản miền ${selectedRegion}`}
            </h2>
            {(searchKeyword || priceFilter !== "all" || showInStockOnly || bestSellerOnly) && (
              <p className="text-sm text-gray-500 mt-1">
                {searchKeyword
                  ? `Kết quả tìm kiếm cho: "${searchKeyword}"`
                  : "Đang lọc sản phẩm theo tùy chọn"}
              </p>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            <div className="relative w-full sm:w-72">
              <input
                type="text"
                value={searchKeyword}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Tìm kiếm sản phẩm..."
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 pr-10 text-sm outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                🔎
              </span>
            </div>

            <select
              value={sortBy}
              onChange={(e) =>
                setSortBy(
                  e.target.value as
                    | "featured"
                    | "price-asc"
                    | "price-desc"
                    | "name-asc"
                    | "best-seller"
                )
              }
              className="rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100"
            >
              <option value="featured">Sắp xếp: mặc định</option>
              <option value="price-asc">Giá thấp đến cao</option>
              <option value="price-desc">Giá cao đến thấp</option>
              <option value="name-asc">Tên A - Z</option>
              <option value="best-seller">Bán chạy nhất</option>
            </select>
          </div>
        </div>

        <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex flex-wrap gap-2">
              {[
                { value: "all", label: "Tất cả giá" },
                { value: "under-100", label: "Dưới 100k" },
                { value: "100-200", label: "100k - 200k" },
                { value: "200-500", label: "200k - 500k" },
                { value: "over-500", label: "Trên 500k" },
              ].map((item) => (
                <button
                  key={item.value}
                  onClick={() => setPriceFilter(item.value as typeof priceFilter)}
                  className={`rounded-full border px-3 py-1.5 text-sm transition ${
                    priceFilter === item.value
                      ? "border-slate-700 bg-slate-700 text-white"
                      : "border-gray-300 bg-white text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <select
                value={ratingFilter}
                onChange={(e) =>
                  setRatingFilter(e.target.value as typeof ratingFilter)
                }
                className="rounded-full border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 outline-none focus:border-green-500"
              >
                <option value="all">Theo đánh giá: tất cả</option>
                <option value="4.5">⭐ 4.5+</option>
                <option value="4.0">⭐ 4.0 - 4.5</option>
                <option value="3.5">⭐ 3.5 - 4.0</option>
              </select>

              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={showInStockOnly}
                  onChange={() => setShowInStockOnly(!showInStockOnly)}
                  className="h-4 w-4 accent-slate-700"
                />
                Chỉ còn hàng
              </label>

              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={bestSellerOnly}
                  onChange={() => setBestSellerOnly(!bestSellerOnly)}
                  className="h-4 w-4 accent-slate-700"
                />
                Bán chạy
              </label>

              <button
                type="button"
                onClick={() => {
                  setPriceFilter("all");
                  setRatingFilter("all");
                  setShowInStockOnly(false);
                  setBestSellerOnly(false);
                }}
                className="rounded-full border border-gray-300 bg-gray-100 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-200"
              >
                Xóa bộ lọc
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 md:gap-6">
          {currentProducts.map((product) => (
            <div
              key={product.id}
              className="relative bg-white rounded-lg shadow-md overflow-hidden hover:shadow-xl transition cursor-pointer"
              onClick={() => navigate(`/product/${product.id}`)}
            >
              {product.voucher && (
                <span className="absolute top-2 right-2 bg-red-500 text-white text-xs md:text-sm font-semibold px-2 py-1 rounded-lg shadow-md">
                  -{product.voucher}
                </span>
              )}

              <img
                src={getImageUrl(product.image)}
                alt={product.name}
                className="w-full h-40 md:h-48 object-cover"
                onError={(e) => {
                  e.currentTarget.src = "/img-produce/default.jpg";
                }}
              />

              <div className="p-3 md:p-4">
                <h3 className="font-semibold text-xl md:text-lg mb-1 md:mb-2">
                  {product.name}
                </h3>

                <p className="text-red-600 text-xl font-bold mb-2">
                  {Number(product.price).toLocaleString("vi-VN", {
                    maximumFractionDigits: 0,
                  })}
                  đ
                </p>

                <div className="flex justify-between text-sm text-gray-600 mb-2">
                  <p>
                    Kho:{" "}
                    <span className="font-semibold text-gray-800">
                      {product.soLuongTon}
                    </span>
                  </p>
                  <p>
                    Đã bán:{" "}
                    <span className="font-semibold text-gray-800">
                      {product.daBan}
                    </span>
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    className="flex-1 bg-slate-700 text-white px-3 py-2 rounded-lg hover:bg-slate-800 text-sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/product/${product.id}`);
                    }}
                  >
                    Mua ngay
                  </button>

                  <Button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAddToCart(product);
                    }}
                    disabled={product.soLuongTon === 0}
                  >
                    <FaShoppingCart size={18} />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {currentProducts.length === 0 && !loading && (
          <p className="text-gray-500 mt-8 text-center">
            Không có sản phẩm nào phù hợp.
          </p>
        )}

        {/* Phân trang */}
        {totalPages > 1 && (
          <div className="flex justify-center items-center gap-2 mt-6">
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className={`px-3 py-1 rounded-md ${
                currentPage === 1
                  ? "bg-gray-300 cursor-not-allowed"
                  : "bg-slate-700 text-white hover:bg-slate-800"
              }`}
            >
              Trước
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <button
                key={page}
                onClick={() => handlePageChange(page)}
                className={`px-3 py-1 rounded-md ${
                  currentPage === page
                    ? "bg-slate-700 text-white"
                    : "bg-gray-200 hover:bg-gray-300"
                }`}
              >
                {page}
              </button>
            ))}
            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className={`px-3 py-1 rounded-md ${
                currentPage === totalPages
                  ? "bg-gray-300 cursor-not-allowed"
                  : "bg-slate-700 text-white hover:bg-slate-800"
              }`}
            >
              Sau
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Products;
