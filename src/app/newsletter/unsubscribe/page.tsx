'use client';

import { useSearchParams } from 'next/navigation';
import { useState, Suspense } from 'react';

function UnsubscribeContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUnsubscribed, setIsUnsubscribed] = useState(false);
  const [error, setError] = useState('');
  const [email, setEmail] = useState('');
  const [selectedReason, setSelectedReason] = useState('');
  const [otherReason, setOtherReason] = useState('');

  const reasons = [
    'Too many emails',
    'Content not relevant',
    'No longer interested',
    'Found better alternative',
    'Privacy concerns',
    'Other'
  ];

  const handleUnsubscribe = async () => {
    if (!token) {
      setError('Invalid unsubscribe link. Please use the link from your email.');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const response = await fetch('/api/newsletter/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          reason: selectedReason === 'Other' ? otherReason : selectedReason
        })
      });

      const data = await response.json();

      if (response.ok) {
        setEmail(data.email);
        setIsUnsubscribed(true);
      } else {
        setError(data.error || 'Failed to unsubscribe. Please try again.');
      }
    } catch (err) {
      setError('Something went wrong. Please try again later.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-zinc-900 rounded-lg p-8 border border-zinc-800">
          <div className="text-center">
            <div className="text-red-500 text-5xl mb-4">⚠️</div>
            <h1 className="text-2xl font-bold text-white mb-2">Invalid Link</h1>
            <p className="text-zinc-400">
              This unsubscribe link is invalid. Please use the link from your email.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (isUnsubscribed) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-zinc-900 rounded-lg p-8 border border-zinc-800">
          <div className="text-center">
            <div className="text-green-500 text-5xl mb-4">✓</div>
            <h1 className="text-2xl font-bold text-white mb-2">Unsubscribed Successfully</h1>
            <p className="text-zinc-400 mb-6">
              {email && <><strong className="text-white">{email}</strong> has been</>} removed from our newsletter list.
              You will no longer receive emails from us.
            </p>
            <p className="text-sm text-zinc-500">
              Changed your mind? You can always resubscribe at{' '}
              <a href="https://news.fasttakeoff.org" className="text-teal-400 hover:text-teal-300">
                news.fasttakeoff.org
              </a>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full bg-zinc-900 rounded-lg p-8 border border-zinc-800">
        <div className="text-center mb-6">
          <div className="text-yellow-500 text-5xl mb-4">📧</div>
          <h1 className="text-2xl font-bold text-white mb-2">Unsubscribe from Newsletter</h1>
          <p className="text-zinc-400">
            We're sorry to see you go. You'll stop receiving newsletters from Fast Takeoff News.
          </p>
        </div>

        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              Help us improve (optional)
            </label>
            <div className="space-y-2">
              {reasons.map((reason) => (
                <label key={reason} className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="radio"
                    name="reason"
                    value={reason}
                    checked={selectedReason === reason}
                    onChange={(e) => setSelectedReason(e.target.value)}
                    className="w-4 h-4 text-teal-500 bg-zinc-800 border-zinc-700 focus:ring-teal-500 focus:ring-2"
                  />
                  <span className="text-zinc-300 text-sm">{reason}</span>
                </label>
              ))}
            </div>
          </div>

          {selectedReason === 'Other' && (
            <div>
              <textarea
                value={otherReason}
                onChange={(e) => setOtherReason(e.target.value)}
                placeholder="Please tell us more..."
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
                rows={3}
              />
            </div>
          )}
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-900/20 border border-red-800 rounded-md">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        <button
          onClick={handleUnsubscribe}
          disabled={isSubmitting}
          className="w-full bg-teal-600 hover:bg-teal-700 disabled:bg-zinc-700 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-md transition-colors"
        >
          {isSubmitting ? 'Unsubscribing...' : 'Confirm Unsubscribe'}
        </button>

        <p className="text-center text-xs text-zinc-500 mt-4">
          Clicked by mistake?{' '}
          <a href="https://news.fasttakeoff.org" className="text-teal-400 hover:text-teal-300">
            Go back to homepage
          </a>
        </p>
      </div>
    </div>
  );
}

export default function UnsubscribePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-zinc-400">Loading...</div>
      </div>
    }>
      <UnsubscribeContent />
    </Suspense>
  );
}
