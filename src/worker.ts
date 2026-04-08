interface BenchmarkRequest {
  deviceId: string;
  benchmarkType: 'full' | 'gpu' | 'cpu' | 'sensors' | 'realworld';
  options?: {
    duration?: number;
    iterations?: number;
    stressLevel?: 'low' | 'medium' | 'high';
  };
}

interface HardwareProfile {
  deviceId: string;
  timestamp: number;
  gpu?: {
    tops: number;
    memoryBandwidth: number;
    precision: 'fp16' | 'fp32' | 'int8';
    vendor: string;
    model: string;
  };
  cpu?: {
    cores: number;
  };
  sensors?: {
    latency: number;
    accuracy: number;
    sampleRate: number;
  };
  realworld?: {
    score: number;
    tasks: Array<{
      name: string;
      duration: number;
      efficiency: number;
    }>;
  };
  fleetScore: number;
}

interface ComparisonResult {
  devices: string[];
  scores: {
    gpu: number[];
    cpu: number[];
    sensors: number[];
    realworld: number[];
    fleet: number[];
  };
  recommendations: string[];
}

const PROFILES = new Map<string, HardwareProfile>();
const COMPARISONS = new Map<string, ComparisonResult>();

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const SECURITY_HEADERS = {
  'Content-Security-Policy': "default-src 'self'; script-src 'self'",
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
};

async function handleRequest(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: { ...CORS_HEADERS, ...SECURITY_HEADERS },
    });
  }

  if (path === '/health') {
    return new Response(JSON.stringify({ status: 'healthy', timestamp: Date.now() }), {
      headers: {
        'Content-Type': 'application/json',
        ...CORS_HEADERS,
        ...SECURITY_HEADERS,
      },
    });
  }

  if (path === '/api/benchmark' && request.method === 'POST') {
    try {
      const data: BenchmarkRequest = await request.json();
      const profile = await runBenchmark(data);
      PROFILES.set(profile.deviceId, profile);
      
      return new Response(JSON.stringify(profile), {
        status: 201,
        headers: {
          'Content-Type': 'application/json',
          ...CORS_HEADERS,
          ...SECURITY_HEADERS,
        },
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: 'Invalid benchmark request' }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          ...CORS_HEADERS,
          ...SECURITY_HEADERS,
        },
      });
    }
  }

  if (path.startsWith('/api/profile/') && request.method === 'GET') {
    const deviceId = path.split('/api/profile/')[1];
    const profile = PROFILES.get(deviceId);
    
    if (!profile) {
      return new Response(JSON.stringify({ error: 'Profile not found' }), {
        status: 404,
        headers: {
          'Content-Type': 'application/json',
          ...CORS_HEADERS,
          ...SECURITY_HEADERS,
        },
      });
    }
    
    return new Response(JSON.stringify(profile), {
      headers: {
        'Content-Type': 'application/json',
        ...CORS_HEADERS,
        ...SECURITY_HEADERS,
      },
    });
  }

  if (path === '/api/compare' && request.method === 'GET') {
    const deviceIds = url.searchParams.get('devices')?.split(',') || [];
    
    if (deviceIds.length < 2) {
      return new Response(JSON.stringify({ error: 'At least 2 devices required' }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          ...CORS_HEADERS,
          ...SECURITY_HEADERS,
        },
      });
    }
    
    const comparison = await compareDevices(deviceIds);
    const comparisonId = generateId();
    COMPARISONS.set(comparisonId, comparison);
    
    return new Response(JSON.stringify({ comparisonId, ...comparison }), {
      headers: {
        'Content-Type': 'application/json',
        ...CORS_HEADERS,
        ...SECURITY_HEADERS,
      },
    });
  }

  return new Response(JSON.stringify({ error: 'Not found' }), {
    status: 404,
    headers: {
      'Content-Type': 'application/json',
      ...CORS_HEADERS,
      ...SECURITY_HEADERS,
    },
  });
}

async function runBenchmark(request: BenchmarkRequest): Promise<HardwareProfile> {
  const timestamp = Date.now();
  const profile: HardwareProfile = {
    deviceId: request.deviceId,
    timestamp,
    fleetScore: 0,
  };

  if (request.benchmarkType === 'full' || request.benchmarkType === 'gpu') {
    profile.gpu = {
      tops: Math.random() * 1000,
      memoryBandwidth: Math.random() * 1000,
      precision: 'fp16',
      vendor: 'NVIDIA',
      model: 'A100',
    };
  }

  if (request.benchmarkType === 'full' || request.benchmarkType === 'cpu') {
    profile.cpu = {
      cores: 8,
    };
  }

  if (request.benchmarkType === 'full' || request.benchmarkType === 'sensors') {
    profile.sensors = {
      latency: Math.random() * 100,
      accuracy: Math.random() * 100,
      sampleRate: Math.random() * 1000,
    };
  }

  if (request.benchmarkType === 'full' || request.benchmarkType === 'realworld') {
    profile.realworld = {
      score: Math.random() * 100,
      tasks: [
        { name: 'inference', duration: 100, efficiency: 0.95 },
        { name: 'training', duration: 500, efficiency: 0.85 },
      ],
    };
  }

  profile.fleetScore = calculateFleetScore(profile);
  
  return profile;
}

function calculateFleetScore(profile: HardwareProfile): number {
  let score = 0;
  
  if (profile.gpu) {
    score += profile.gpu.tops * 0.4;
    score += profile.gpu.memoryBandwidth * 0.3;
  }
  
  if (profile.cpu) {
    score += profile.cpu.cores * 10;
  }
  
  if (profile.sensors) {
    score += (100 - profile.sensors.latency) * 0.1;
    score += profile.sensors.accuracy * 0.1;
  }
  
  if (profile.realworld) {
    score += profile.realworld.score * 0.2;
  }
  
  return Math.round(score);
}

async function compareDevices(deviceIds: string[]): Promise<ComparisonResult> {
  const profiles = deviceIds.map(id => PROFILES.get(id)).filter(Boolean) as HardwareProfile[];
  
  const scores = {
    gpu: profiles.map(p => p.gpu?.tops || 0),
    cpu: profiles.map(p => p.cpu?.cores || 0),
    sensors: profiles.map(p => p.sensors?.latency ? 100 - p.sensors.latency : 0),
    realworld: profiles.map(p => p.realworld?.score || 0),
    fleet: profiles.map(p => p.fleetScore),
  };
  
  const recommendations = generateRecommendations(profiles);
  
  return {
    devices: deviceIds,
    scores,
    recommendations,
  };
}

function generateRecommendations(profiles: HardwareProfile[]): string[] {
  const recommendations: string[] = [];
  
  if (profiles.length >= 2) {
    const maxGpu = Math.max(...profiles.map(p => p.gpu?.tops || 0));
    const maxCpu = Math.max(...profiles.map(p => p.cpu?.cores || 0));
    
    profiles.forEach((profile, index) => {
      if (profile.gpu && profile.gpu.tops === maxGpu) {
        recommendations.push(`Device ${profile.deviceId} has the best GPU performance`);
      }
      if (profile.cpu && profile.cpu.cores === maxCpu) {
        recommendations.push(`Device ${profile.deviceId} has the most CPU cores`);
      }
    });
  }
  
  return recommendations;
}

function generateId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

function generateFooter(): string {
  return `
    <footer style="
      position: fixed;
      bottom: 0;
      width: 100%;
      background: #0a0a0f;
      color: #dc2626;
      text-align: center;
      padding: 1rem;
      font-family: 'Inter', sans-serif;
      border-top: 1px solid #dc2626;
    ">
      Metal Profile © ${new Date().getFullYear()} | Fleet Hardware Profiling
    </footer>
  `;
}

export default {
  async fetch(request: Request): Promise<Response> {
    return handleRequest(request);
  }
};
