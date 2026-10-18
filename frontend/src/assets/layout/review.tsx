import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/card";
import { FaStar, FaRegStar, FaTimes, FaPenAlt } from "react-icons/fa";
import { motion, AnimatePresence } from "framer-motion";
import { useInView } from "react-intersection-observer";
import avt from "@/assets/images/default.jpg";
import api from "@/api/axiosInstance";
import type { Feedback } from "@/types/feedback.type";
import { Button } from "@/components/button";
import { sendFeedback } from "@/api/feedback";
import { showSuccess, showError } from "@/common/toast";

export default function CustomerReviews() {
  const [reviews, setReviews] = useState<Feedback[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [ref, inView] = useInView({ triggerOnce: true, threshold: 0.2 });

  // ✅ Form viết đánh giá
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // ✅ Gọi API
  const fetchReviews = async (page = 1) => {
    try {
      setLoading(true);
      const res = await api.get(`/feedback?page=${page}&limit=6`);
      setReviews(res.data.data || []);
      setTotalPages(res.data.pagination?.totalPages || 1);
    } catch (error) {
      console.error("Lỗi khi tải đánh giá:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReviews(page);
  }, [page]);

  const handleSubmitReview = async () => {
    if (rating === 0) {
      showError("Vui lòng chọn số sao đánh giá!");
      return;
    }
    if (comment.trim().length < 5) {
      showError("Nội dung đánh giá quá ngắn!");
      return;
    }

    try {
      setSubmitting(true);
      await sendFeedback(rating, comment);

      showSuccess(
        "Cảm ơn bạn! Mỗi lượt đánh giá là động lực giúp Shop hoàn thiện hơn ❤️"
      );

      setIsFormOpen(false);
      setRating(0);
      setComment("");

      // Về lại trang 1 để thấy ngay đánh giá vừa gửi
      if (page === 1) {
        fetchReviews(1);
      } else {
        setPage(1);
      }
    } catch (err: any) {
      const status = err.response?.status;
      if (status === 401) {
        showError("Vui lòng đăng nhập để gửi đánh giá!");
      } else {
        showError("Gửi đánh giá thất bại, vui lòng thử lại!");
      }
      console.error("❌ Lỗi khi gửi đánh giá:", err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="py-12 bg-emerald-50 flex justify-center">
      <div className="max-w-6xl w-full text-center">
        <motion.div ref={ref} className="text-center">
          <motion.span
            initial={{ opacity: 0, y: 30 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6 }}
            className="flex justify-center text-yellow-500 text-2xl mt-2"
            style={{ fontFamily: "'Ga Maamli', sans-serif" }}
          >
            Ba Miền Review
          </motion.span>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="flex justify-center text-4xl mb-6 mt-2 font-bold"
            style={{ fontFamily: "'Baloo 2', cursive" }}
          >
            <div className="flex items-center gap-4">
              <div className="w-2 h-2 rounded-full bg-yellow-400" />
              <div>ĐÁNH GIÁ TỪ KHÁCH HÀNG</div>
              <div className="w-2 h-2 rounded-full bg-yellow-400" />
            </div>
          </motion.div>

          <Button
            onClick={() => setIsFormOpen(true)}
            className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white mb-4"
          >
            <FaPenAlt size={14} /> Viết đánh giá
          </Button>
        </motion.div>

        {loading && <p className="text-gray-500">Đang tải đánh giá...</p>}

        <div className="grid gap-6 px-6 sm:grid-cols-2 lg:grid-cols-3 mt-4">
          {!loading &&
            reviews.map((review, index) => (
              <motion.div
                key={review.id || index}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: index * 0.1 }}
                viewport={{ once: true }}
              >
                <Card className="rounded-xl shadow-md hover:shadow-xl transition h-64 flex">
                  <CardContent className="p-4 flex flex-col items-center justify-center text-center space-y-3">
                    <img
                      src={avt}
                      alt={review.fullname}
                      className="w-16 h-16 rounded-full object-cover border-2 border-gray-200"
                    />

                    <p className="text-gray-600 text-sm italic line-clamp-3">
                      "{review.comment}"
                    </p>

                    <div className="flex items-center justify-center space-x-1">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <FaStar
                          key={i}
                          size={18}
                          className={
                            i < review.rating
                              ? "fill-yellow-400 text-yellow-400"
                              : "text-gray-300"
                          }
                        />
                      ))}
                    </div>

                    {/* ✅ Hiển thị tên + tỉnh thành */}
                    <div className="text-center">
                      <h4 className="font-semibold text-gray-800 text-base">
                        {review.fullname}
                      </h4>
                      {review.TinhThanh && (
                        <p className="text-gray-500 text-sm">
                          {review.TinhThanh}
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
        </div>

        {/* ✅ Phân trang */}
        {totalPages > 1 && (
          <div className="flex justify-center items-center gap-3 mt-8">
            <button
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
              className="px-3 py-1 bg-white border rounded hover:bg-gray-100 disabled:opacity-50"
            >
              ← Trước
            </button>

            <span className="text-gray-700">
              Trang {page} / {totalPages}
            </span>

            <button
              disabled={page === totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="px-3 py-1 bg-white border rounded hover:bg-gray-100 disabled:opacity-50"
            >
              Sau →
            </button>
          </div>
        )}
      </div>

      {/* ✅ Form viết đánh giá */}
      <AnimatePresence>
        {isFormOpen && (
          <motion.div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm flex justify-center items-center z-70"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: "spring", stiffness: 200, damping: 15 }}
              className="bg-white rounded-2xl shadow-2xl p-6 w-[90%] max-w-md relative"
            >
              <button
                onClick={() => setIsFormOpen(false)}
                className="absolute top-3 right-3 text-gray-500 hover:text-black"
              >
                <FaTimes size={20} />
              </button>

              <h2 className="text-xl font-bold text-center mb-4 text-amber-600">
                Đánh giá của bạn cho Shop
              </h2>

              <div className="flex justify-center mb-4">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHover(star)}
                    onMouseLeave={() => setHover(0)}
                  >
                    {star <= (hover || rating) ? (
                      <FaStar className="text-yellow-400 text-2xl" />
                    ) : (
                      <FaRegStar className="text-gray-400 text-2xl" />
                    )}
                  </button>
                ))}
              </div>

              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Hãy chia sẻ cảm nhận của bạn..."
                className="w-full border border-gray-300 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-amber-500 h-28 resize-none"
              />

              <button
                onClick={handleSubmitReview}
                disabled={submitting}
                className={`w-full mt-4 bg-amber-500 hover:bg-amber-600 text-white py-2 rounded-lg font-semibold transition ${
                  submitting ? "opacity-70 cursor-not-allowed" : ""
                }`}
              >
                {submitting ? "Đang gửi..." : "Gửi đánh giá"}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
