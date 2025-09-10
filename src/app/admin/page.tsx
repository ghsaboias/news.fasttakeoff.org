import { currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import CronMonitorDashboard from '@/components/CronMonitorDashboard';

export default async function AdminPage() {
  const user = await currentUser();
  
  if (!user || user.emailAddresses[0]?.emailAddress !== 'iamguilherme1@gmail.com') {
    redirect('/');
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">Admin Dashboard</h1>
          <p className="text-muted-foreground mt-2">Cron Jobs & System Monitoring</p>
        </div>

        {/* Cron Jobs Overview */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-card rounded-lg shadow p-6 border border-border">
            <h2 className="text-xl font-semibold mb-4 text-card-foreground">Active Cron Jobs</h2>
            <div className="space-y-3">
              <div className="flex justify-between items-center p-3 bg-muted rounded">
                <div>
                  <span className="font-mono text-sm text-foreground">*/15 * * * *</span>
                  <p className="text-sm text-muted-foreground">Messages + Window Evaluation</p>
                </div>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary text-primary-foreground">
                  Active
                </span>
              </div>
              <div className="flex justify-between items-center p-3 bg-muted rounded">
                <div>
                  <span className="font-mono text-sm text-foreground">0 * * * *</span>
                  <p className="text-sm text-muted-foreground">MktNews + Cache Maintenance</p>
                </div>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary text-primary-foreground">
                  Active
                </span>
              </div>
              <div className="flex justify-between items-center p-3 bg-muted rounded">
                <div>
                  <span className="font-mono text-sm text-foreground">0 */2 * * *</span>
                  <p className="text-sm text-muted-foreground">Feeds + Social Media</p>
                </div>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary text-primary-foreground">
                  Active
                </span>
              </div>
              <div className="flex justify-between items-center p-3 bg-muted rounded">
                <div>
                  <span className="font-mono text-sm text-foreground">0 */6 * * *</span>
                  <p className="text-sm text-muted-foreground">Executive Summary</p>
                </div>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary text-primary-foreground">
                  Active
                </span>
              </div>
            </div>
          </div>

          <div className="bg-card rounded-lg shadow p-6 border border-border">
            <h2 className="text-xl font-semibold mb-4 text-card-foreground">Manual Triggers</h2>
            <div className="grid grid-cols-2 gap-3">
              <button className="p-3 text-sm bg-secondary hover:bg-secondary-hover text-secondary-foreground rounded border border-border transition-colors">
                MESSAGES
              </button>
              <button className="p-3 text-sm bg-secondary hover:bg-secondary-hover text-secondary-foreground rounded border border-border transition-colors">
                WINDOW_EVAL
              </button>
              <button className="p-3 text-sm bg-secondary hover:bg-secondary-hover text-secondary-foreground rounded border border-border transition-colors">
                EXECUTIVE_SUMMARY
              </button>
              <button className="p-3 text-sm bg-secondary hover:bg-secondary-hover text-secondary-foreground rounded border border-border transition-colors">
                FEEDS_GERAL
              </button>
              <button className="p-3 text-sm bg-secondary hover:bg-secondary-hover text-secondary-foreground rounded border border-border transition-colors">
                MKTNEWS
              </button>
              <button className="p-3 text-sm bg-secondary hover:bg-secondary-hover text-secondary-foreground rounded border border-border transition-colors">
                FEEDS_MERCADO
              </button>
            </div>
          </div>
        </div>

        {/* Advanced Cron Monitoring */}
        <CronMonitorDashboard />

        {/* System Stats Placeholder */}
        <div className="bg-card rounded-lg shadow p-6 border border-border">
          <h2 className="text-xl font-semibold mb-4 text-card-foreground">System Status</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-accent">✓</div>
              <p className="text-sm text-muted-foreground">Cloudflare Worker</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-accent">✓</div>
              <p className="text-sm text-muted-foreground">KV Storage</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-accent">✓</div>
              <p className="text-sm text-muted-foreground">D1 Database</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}