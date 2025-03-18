'use client'

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useState } from "react"

export default function KVTestPage() {
    const [key, setKey] = useState('test-key')
    const [value, setValue] = useState('{"test":"data"}')
    const [result, setResult] = useState<Record<string, unknown> | null>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // Function to read from KV
    async function readFromKV() {
        setLoading(true)
        setError(null)
        try {
            const response = await fetch(`/api/kv-test?key=${encodeURIComponent(key)}`)
            const data = await response.json()
            setResult(data)
        } catch (error) {
            console.error('Error reading from KV:', error)
            setError(error instanceof Error ? error.message : 'Unknown error')
        } finally {
            setLoading(false)
        }
    }

    // Function to write to KV
    async function writeToKV() {
        setLoading(true)
        setError(null)
        try {
            let valueObj
            try {
                valueObj = JSON.parse(value)
            } catch {
                valueObj = value // Use as string if not valid JSON
            }

            const response = await fetch('/api/kv-test', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key, value: valueObj })
            })
            const data = await response.json()
            setResult(data)
        } catch (error) {
            console.error('Error writing to KV:', error)
            setError(error instanceof Error ? error.message : 'Unknown error')
        } finally {
            setLoading(false)
        }
    }

    // Read and display homepage cache
    async function readHomepageCache() {
        setLoading(true)
        setError(null)
        try {
            const response = await fetch('/api/kv-test?key=homepage:reports')
            const data = await response.json()
            setResult(data)
        } catch (error) {
            console.error('Error reading homepage cache:', error)
            setError(error instanceof Error ? error.message : 'Unknown error')
        } finally {
            setLoading(false)
        }
    }

    // Delete homepage cache to test fresh load
    async function deleteHomepageCache() {
        setLoading(true)
        setError(null)
        try {
            // Use an empty value with 0 TTL to effectively delete
            const response = await fetch('/api/kv-test', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    key: 'homepage:reports',
                    value: null,
                    delete: true
                })
            })
            const data = await response.json()
            setResult(data)
        } catch (error) {
            console.error('Error deleting homepage cache:', error)
            setError(error instanceof Error ? error.message : 'Unknown error')
        } finally {
            setLoading(false)
        }
    }

    // Test homepage API directly
    async function testHomepageAPI() {
        setLoading(true)
        setError(null)
        try {
            const response = await fetch('/api/reports', {
                method: 'GET',
                headers: { 'Cache-Control': 'no-cache' },
                next: { revalidate: 0 }
            })
            const data = await response.json()
            setResult({
                success: true,
                message: 'Homepage API response',
                data
            })
        } catch (error) {
            console.error('Error calling homepage API:', error)
            setError(error instanceof Error ? error.message : 'Unknown error')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="container mx-auto py-8">
            <h1 className="text-2xl font-bold mb-6">KV Cache Testing</h1>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <Card>
                    <CardHeader>
                        <CardTitle>Custom KV Operations</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">Key</label>
                            <Input
                                value={key}
                                onChange={(e) => setKey(e.target.value)}
                                placeholder="Cache key"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Value (JSON or string)</label>
                            <textarea
                                className="w-full min-h-[100px] p-2 border rounded-md"
                                value={value}
                                onChange={(e) => setValue(e.target.value)}
                                placeholder="Cache value (JSON or string)"
                            />
                        </div>
                    </CardContent>
                    <CardFooter className="flex justify-between">
                        <Button onClick={readFromKV} disabled={loading} variant="outline">
                            Read
                        </Button>
                        <Button onClick={writeToKV} disabled={loading}>
                            Write
                        </Button>
                    </CardFooter>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Homepage Cache Operations</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <p className="text-sm text-muted-foreground">
                            Test operations on the homepage reports cache
                        </p>
                    </CardContent>
                    <CardFooter className="flex justify-between">
                        <Button onClick={readHomepageCache} disabled={loading} variant="outline">
                            Read Cache
                        </Button>
                        <Button onClick={deleteHomepageCache} disabled={loading} variant="destructive">
                            Delete Cache
                        </Button>
                        <Button onClick={testHomepageAPI} disabled={loading}>
                            Test API
                        </Button>
                    </CardFooter>
                </Card>
            </div>

            {error && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
                    <p className="font-bold">Error</p>
                    <p>{error}</p>
                </div>
            )}

            {result && (
                <Card>
                    <CardHeader>
                        <CardTitle>Result</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <pre className="bg-gray-100 p-4 rounded overflow-auto max-h-[400px]">
                            {JSON.stringify(result, null, 2)}
                        </pre>
                    </CardContent>
                </Card>
            )}
        </div>
    )
} 