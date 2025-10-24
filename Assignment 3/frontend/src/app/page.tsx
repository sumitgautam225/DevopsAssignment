'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';

export default function Home() {
  const [repositoryUrl, setRepositoryUrl] = useState('');
  const [githubToken, setGithubToken] = useState('');
  const [dockerfile, setDockerfile] = useState('');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setProgress(5);
    setError('');

    // simple progress animation while waiting for the server
    let interval: number | undefined;
    const startProgress = () => {
      interval = window.setInterval(() => {
        setProgress((p) => {
          if (p >= 95) return 95;
          return Math.min(95, p + Math.floor(Math.random() * 10) + 3);
        });
      }, 700);
    };
    startProgress();

    try {
      const response = await fetch('http://localhost:5000/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          repositoryUrl,
          githubToken,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to generate Dockerfile');
      }

      setDockerfile(data.data.dockerfile);
      setProgress(100);
    } catch (err: any) {
      setError(err.message || 'An error occurred');
      setProgress(0);
    } finally {
      setLoading(false);
      // ensure interval cleared and progress finalized
      // small timeout so UI shows 100% briefly
      setTimeout(() => setProgress((p) => (p >= 100 ? 100 : p)), 300);
      try {
        // clear interval if set
        (window as any).clearInterval;
      } catch { }
    }
  };

  const handlePush = async () => {
    if (!dockerfile) return setError('No Dockerfile to push');
    setLoading(true);
    setError('');
    try {
      const resp = await fetch('http://localhost:5000/api/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repositoryUrl, githubToken, dockerfile }),
      });
      const data = await resp.json();
      if (!data.success) throw new Error(data.error || 'Push failed');
      alert(`Pushed to branch: ${data.data.branch}`);
    } catch (err: any) {
      setError(err.message || 'Push failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-50 to-white py-8 px-4">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold text-center mb-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-transparent bg-clip-text">
          DockGen AI
        </h1>
        <p className="text-center text-gray-600 mb-8">Generate Dockerfiles with AI for your JavaScript projects</p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Side - Form */}
          <Card className="h-fit border-0 shadow-xl bg-white/70 backdrop-blur-sm">
            <CardHeader className="space-y-1">
              <CardTitle className="text-2xl">Generate Dockerfile</CardTitle>
              <CardDescription className="text-gray-600">
                Enter your repository details below
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-700">Repository URL</label>
                  <Input
                    type="text"
                    placeholder="https://github.com/username/repo"
                    value={repositoryUrl}
                    onChange={(e) => setRepositoryUrl(e.target.value)}
                    className="h-11 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-700">Personal Access Token</label>
                  <Input
                    type="password"
                    placeholder="ghp_xxxxxxxxxxxxxxxx"
                    value={githubToken}
                    onChange={(e) => setGithubToken(e.target.value)}
                    className="h-11 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                    required
                  />
                </div>
                <Button 
                  type="submit" 
                  disabled={loading}
                  className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white transition-colors"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                      </svg>
                      Generating...
                    </span>
                  ) : 'Generate & Build Image'}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Right Side - Output */}
          <div className="space-y-4">
            {error && (
              <Card className="border-red-200 bg-red-50/50 backdrop-blur-sm shadow-lg">
                <CardContent className="p-4">
                  <p className="text-red-600 flex items-center gap-2">
                    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"/>
                    </svg>
                    {error}
                  </p>
                </CardContent>
              </Card>
            )}

            <Card className={`min-h-[400px] border-0 shadow-xl bg-white/70 backdrop-blur-sm 
              ${!loading && !dockerfile ? 'border-2 border-dashed border-gray-200' : ''}`}>
              <CardHeader>
                <CardTitle className="text-xl text-gray-800">
                  {loading ? 'Generating Dockerfile...' : dockerfile ? 'Generated Dockerfile' : 'Output'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading && (
                  <div className="space-y-6">
                    <div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-600 transition-all duration-500 ease-out"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <p className="text-right text-sm text-gray-500 mt-2">{progress}%</p>
                    </div>
                    <div className="animate-pulse space-y-4">
                      {[1, 2, 3].map(i => (
                        <div key={i} className="h-4 bg-gray-100 rounded w-full" 
                          style={{ width: `${100 - i * 15}%` }}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {dockerfile && (
                  <div className="space-y-4">
                    <pre className="bg-gray-900 text-gray-100 p-6 rounded-lg overflow-x-auto max-h-[400px] overflow-y-auto font-mono text-sm">
                      <code>{dockerfile}</code>
                    </pre>
                    <Button 
                      onClick={handlePush} 
                      disabled={loading || !githubToken}
                      className="w-full h-11 bg-green-600 hover:bg-green-700 text-white transition-colors"
                    >
                      Push to Repository
                    </Button>
                  </div>
                )}

                {!loading && !dockerfile && (
                  <div className="h-[300px] flex items-center justify-center text-gray-400">
                    <div className="text-center space-y-2">
                      <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                      </svg>
                      <p>Your Dockerfile will appear here</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </main>
  );
}
