import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getCorsHeaders(request: NextRequest) {
  const origin = request.headers.get('origin') || '';
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: getCorsHeaders(request),
  });
}

export async function POST(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Server configuration error: missing credentials' },
        { status: 500, headers: getCorsHeaders(request) }
      );
    }

    // 1. Authenticate supervisor/admin
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Unauthorized: Missing Authorization header' },
        { status: 401, headers: getCorsHeaders(request) }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const supabaseWithAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    });

    const { data: { user }, error: authError } = await supabaseWithAuth.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized: Invalid token' },
        { status: 401, headers: getCorsHeaders(request) }
      );
    }

    // Fetch requester's profile using service role to check role
    const supabaseServer = createClient(supabaseUrl, supabaseServiceKey);
    const { data: requesterProfile, error: rpError } = await supabaseServer
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (rpError || !requesterProfile) {
      return NextResponse.json(
        { error: 'Forbidden: Profile not found' },
        { status: 403, headers: getCorsHeaders(request) }
      );
    }

    const isSupervisor = requesterProfile.role === 'supervisor';
    const isAdmin = requesterProfile.role === 'admin';

    if (!isSupervisor && !isAdmin) {
      return NextResponse.json(
        { error: 'Forbidden: Access denied' },
        { status: 403, headers: getCorsHeaders(request) }
      );
    }

    // 2. Fetch profiles list using service role (bypass slow RLS check)
    const { data: profiles, error: dbError } = await supabaseServer
      .from('profiles')
      .select('*')
      .order('username', { ascending: true });

    if (dbError) {
      console.error('[SupervisorGetProfiles] DB error:', dbError);
      return NextResponse.json(
        { error: 'Internal database error' },
        { status: 500, headers: getCorsHeaders(request) }
      );
    }

    return NextResponse.json({ profiles }, { headers: getCorsHeaders(request) });

  } catch (err) {
    console.error('[SupervisorGetProfiles] Unexpected error:', err);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500, headers: getCorsHeaders(request) }
    );
  }
}
