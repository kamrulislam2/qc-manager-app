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

    // Fetch requester's profile using service role to trust role definition
    const supabaseServer = createClient(supabaseUrl, supabaseServiceKey);
    const { data: requesterProfile, error: rpError } = await supabaseServer
      .from('profiles')
      .select('id, role')
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

    // 2. Parse payload
    const { staffId } = await request.json();
    if (!staffId) {
      return NextResponse.json(
        { error: 'Bad Request: Missing staffId' },
        { status: 400, headers: getCorsHeaders(request) }
      );
    }

    // 3. If supervisor, check if target staff is supervised by this supervisor
    if (isSupervisor) {
      const { data: targetProfile, error: tpError } = await supabaseServer
        .from('profiles')
        .select('supervisor_ids')
        .eq('id', staffId)
        .single();

      if (tpError || !targetProfile) {
        return NextResponse.json(
          { error: 'Forbidden: Target staff profile not found' },
          { status: 403, headers: getCorsHeaders(request) }
        );
      }

      const supervisorIds = targetProfile.supervisor_ids || [];
      if (!supervisorIds.includes(requesterProfile.id)) {
        return NextResponse.json(
          { error: 'Forbidden: You do not supervise this user' },
          { status: 403, headers: getCorsHeaders(request) }
        );
      }
    }

    // 4. Fetch leave data using service role (bypass client-side RLS limits)
    const [chutiRes, sRes, hrRes] = await Promise.all([
      supabaseServer
        .from('chuti')
        .select('*')
        .eq('user_id', staffId)
        .is('deleted_at', null)
        .order('date', { ascending: false }),
      supabaseServer
        .from('leave_settlements')
        .select('*')
        .eq('user_id', staffId),
      supabaseServer
        .from('govt_holiday_responses')
        .select('*')
        .eq('user_id', staffId),
    ]);

    if (chutiRes.error || sRes.error || hrRes.error) {
      console.error('[SupervisorGetLeaveData] DB error:', {
        chuti: chutiRes.error,
        settlement: sRes.error,
        holiday: hrRes.error,
      });
      return NextResponse.json(
        { error: 'Internal database error' },
        { status: 500, headers: getCorsHeaders(request) }
      );
    }

    return NextResponse.json({
      chutiData: chutiRes.data || [],
      settlementsData: sRes.data || [],
      holidayResponsesData: hrRes.data || [],
    }, { headers: getCorsHeaders(request) });

  } catch (err) {
    console.error('[SupervisorGetLeaveData] Unexpected error:', err);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500, headers: getCorsHeaders(request) }
    );
  }
}
