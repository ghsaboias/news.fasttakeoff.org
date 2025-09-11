'use client'

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ApiErrorResponse } from "@/lib/types/core"
import { X } from "lucide-react"
import { useState, useCallback, useEffect } from "react"

interface ScrollPopupProps {
  scrollThreshold?: number // Percentage of page scrolled before showing popup
}

export default function ScrollPopup({ scrollThreshold = 25 }: ScrollPopupProps) {
  const [email, setEmail] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitMessage, setSubmitMessage] = useState("")
  const [isVisible, setIsVisible] = useState(false)
  const [isDismissed, setIsDismissed] = useState(false)

  const handleEmailSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()

    if (!email.trim()) {
      setSubmitMessage("Please enter your email address")
      return
    }

    setIsSubmitting(true)
    setSubmitMessage("")

    try {
      const response = await fetch('/api/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: email.trim() }),
      })

      const data = await response.json() as ApiErrorResponse

      if (response.ok) {
        setSubmitMessage("Successfully subscribed! 🎉")
        setEmail("")
        // Auto-hide popup after successful subscription
        setTimeout(() => {
          setIsVisible(false)
          setIsDismissed(true)
        }, 3000)
      } else {
        setSubmitMessage(data.error || "Failed to subscribe")
      }
    } catch (error) {
      console.error('Error submitting email:', error)
      setSubmitMessage("Something went wrong. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }, [email])

  const handleDismiss = useCallback(() => {
    setIsVisible(false)
    setIsDismissed(true)
  }, [])

  useEffect(() => {
    if (isDismissed) return

    const handleScroll = () => {
      const scrollPercent = (window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100
      
      if (scrollPercent >= scrollThreshold && !isVisible) {
        setIsVisible(true)
      }
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [scrollThreshold, isVisible, isDismissed])

  if (!isVisible || isDismissed) {
    return null
  }

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 animate-in fade-in duration-300"
        onClick={handleDismiss}
      />
      
      {/* Popup */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in zoom-in-95 duration-300">
        <div className="bg-gradient-to-br from-gray-800 via-gray-900 to-black rounded-2xl shadow-2xl border border-gray-600/50 p-6 sm:p-8 backdrop-blur-sm w-full max-w-md relative overflow-hidden">
          {/* Industrial texture overlay */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.02)_0%,transparent_50%)] opacity-60"></div>
          <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_49%,rgba(255,255,255,0.01)_50%,transparent_51%)] bg-[length:20px_20px] opacity-30"></div>
          
          {/* Close button */}
          <button
            onClick={handleDismiss}
            className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-200 transition-colors z-10"
          >
            <X size={20} />
          </button>

          <div className="flex flex-col items-center gap-6 relative z-10">
            {/* Headline */}
            <div className="text-center">
              <h2 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-emerald-400 via-teal-400 to-green-400 bg-clip-text text-transparent leading-tight">
                AI-Powered News Intelligence
              </h2>
              <p className="text-lg text-gray-300 mt-3 font-light">
                Get breaking news analysis and real-time intelligence from global sources.
              </p>
            </div>

            {/* Email Form */}
            <form onSubmit={handleEmailSubmit} className="w-full">
              <div className="space-y-4">
                <Input
                  type="email"
                  placeholder="your.email@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isSubmitting}
                  required
                  className="h-12 text-lg bg-gray-800 border-gray-600 text-gray-100 placeholder-gray-500 focus:border-emerald-500 focus:ring-emerald-500 focus:bg-gray-700"
                />

                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full h-12 text-lg font-semibold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-lg hover:shadow-xl transition-all duration-200 border border-emerald-500/30"
                >
                  {isSubmitting ? "Setting up your briefings..." : "Get Free Daily Briefings →"}
                </Button>

                {submitMessage && (
                  <p className={`text-sm text-center ${submitMessage.includes('🎉') ? 'text-green-400' : 'text-red-400'}`}>
                    {submitMessage}
                  </p>
                )}

                <p className="text-xs text-gray-400 text-center">
                  🔒 Your email is secure. We respect your privacy and never share your data.
                </p>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  )
}