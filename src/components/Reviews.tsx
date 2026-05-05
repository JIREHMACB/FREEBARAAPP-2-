import React, { useState } from 'react';
import { Star, StarHalf, MessageSquare, Loader2, Send } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

interface Review {
  id: number;
  userId: number;
  userName: string;
  userAvatar?: string;
  rating: number;
  comment: string;
  createdAt: string;
}

interface ReviewStats {
  averageRating: number;
  reviewCount: number;
}

interface ReviewsProps {
  targetType: 'company' | 'product';
  targetId: number;
  currentUser: any;
}

export default function Reviews({ targetType, targetId, currentUser }: ReviewsProps) {
  const queryClient = useQueryClient();
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['reviews', targetType, targetId],
    queryFn: () => api.reviews.get(targetType, targetId)
  });

  const reviewMutation = useMutation({
    mutationFn: (newReview: { rating: number; comment: string }) => 
      api.reviews.add({ 
        targetType, 
        targetId, 
        rating: newReview.rating, 
        comment: newReview.comment 
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reviews', targetType, targetId] });
      setComment('');
      setRating(5);
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    
    setIsSubmitting(true);
    try {
      await reviewMutation.mutateAsync({ rating, comment });
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStars = (val: number) => {
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            size={16}
            className={star <= val ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}
          />
        ))}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="animate-spin text-blue-600" />
      </div>
    );
  }

  const reviews = data?.reviews || [];
  const stats = data?.stats || { averageRating: 0, reviewCount: 0 };

  return (
    <div className="space-y-8">
      {/* Header & Overall Stats */}
      <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h3 className="text-xl font-bold text-gray-900 mb-1">Avis et Notes</h3>
            <p className="text-sm text-gray-500">Ce que la communauté en pense</p>
          </div>
          
          <div className="flex items-center gap-6">
            <div className="text-center">
              <div className="text-3xl font-extrabold text-gray-900">
                {stats.averageRating.toFixed(1)}
              </div>
              <div className="mt-1">{renderStars(Math.round(stats.averageRating))}</div>
            </div>
            <div className="h-10 w-px bg-gray-100 hidden md:block"></div>
            <div className="text-center">
              <div className="text-xl font-bold text-gray-900">{stats.reviewCount}</div>
              <p className="text-xs text-gray-500 uppercase tracking-wider">Avis</p>
            </div>
          </div>
        </div>
      </div>

      {/* Review Form */}
      {currentUser && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gray-50 rounded-2xl p-6 border border-gray-200"
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold text-gray-700">Votre note</label>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    className="transition-transform active:scale-90"
                  >
                    <Star
                      size={24}
                      className={star <= rating ? "fill-yellow-400 text-yellow-400" : "text-gray-300 hover:text-yellow-200"}
                    />
                  </button>
                ))}
              </div>
            </div>
            
            <div className="relative">
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Racontez votre expérience..."
                className="w-full bg-white border border-gray-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none min-h-[100px]"
                required
              />
            </div>
            
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={isSubmitting || !comment.trim()}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-6 py-2 rounded-xl font-medium flex items-center gap-2 transition-colors"
              >
                {isSubmitting ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <Send size={18} />
                )}
                Publier l'avis
              </button>
            </div>
          </form>
        </motion.div>
      )}

      {/* Reviews List */}
      <div className="space-y-4">
        {reviews.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-gray-200">
            <MessageSquare size={48} className="mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500">Aucun avis pour le moment. Soyez le premier à en laisser un !</p>
          </div>
        ) : (
          reviews.map((review: Review) => (
            <motion.div
              key={review.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm transition-hover hover:shadow-md"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold overflow-hidden border border-white shadow-sm">
                    {review.userAvatar ? (
                      <img src={review.userAvatar} alt={review.userName} className="w-full h-full object-cover" />
                    ) : (
                      review.userName.charAt(0)
                    )}
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-gray-900">{review.userName}</h4>
                    <p className="text-xs text-gray-400">
                      {formatDistanceToNow(new Date(review.createdAt), { addSuffix: true, locale: fr })}
                    </p>
                  </div>
                </div>
                {renderStars(review.rating)}
              </div>
              <p className="text-gray-700 text-sm leading-relaxed italic">
                "{review.comment}"
              </p>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}
