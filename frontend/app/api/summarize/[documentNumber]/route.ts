import { NextRequest, NextResponse } from 'next/server'

export async function POST(
    request: NextRequest,
    { params }: { params: { documentNumber: string } }
) {
    try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/summarize/${params.documentNumber}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
        })

        if (!response.ok) {
            throw new Error('Failed to generate summary')
        }

        const data = await response.json()
        return NextResponse.json(data)
    } catch (error) {
        console.error('Error in summarize API route:', error)
        return NextResponse.json(
            { error: 'Failed to generate summary' },
            { status: 500 }
        )
    }
} 