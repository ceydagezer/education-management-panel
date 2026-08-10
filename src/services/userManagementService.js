import { supabase } from '../lib/supabase'

const normalizeText = (value) =>
  String(value ?? '').trim()

const normalizeEmail = (value) =>
  normalizeText(value).toLowerCase()

const mapProfile = (row) => ({
  id: row.id,
  email: row.email || '',
  fullName: row.full_name || '',
  createdAt: row.created_at || null,
  updatedAt: row.updated_at || null
})

const mapRole = (row) => ({
  userId: row.user_id,
  role: row.role || 'staff',
  createdAt: row.created_at || null,
  updatedAt: row.updated_at || null
})

async function invokeManageUser(body) {
  const {
    data: sessionData,
    error: sessionError
  } = await supabase.auth.getSession()

  const accessToken =
    sessionData?.session?.access_token || ''

  if (
    sessionError ||
    !accessToken
  ) {
    throw new Error(
      'Oturum doğrulanamadı. Lütfen çıkış yapıp tekrar giriş yapınız.'
    )
  }

  const supabaseUrl =
    String(
      import.meta.env
        .VITE_SUPABASE_URL || ''
    )
      .trim()
      .replace(/\/+$/, '')

  const supabaseAnonKey =
    String(
      import.meta.env
        .VITE_SUPABASE_PUBLISHABLE_KEY || ''
    ).trim()

  if (!supabaseUrl) {
    throw new Error(
      'Supabase bağlantı adresi bulunamadı.'
    )
  }

  if (!supabaseAnonKey) {
    throw new Error(
      'Supabase publishable anahtarı bulunamadı.'
    )
  }

  /*
   * functions.invoke yerine doğrudan fetch kullanıyoruz.
   * Böylece Authorization header'ının gerçekten POST isteğine
   * yazıldığından emin oluyoruz.
   */
  let response

  try {
    response = await fetch(
      `${supabaseUrl}/functions/v1/manage-user`,
      {
        method: 'POST',
        headers: {
          Authorization:
            `Bearer ${accessToken}`,
          apikey:
            supabaseAnonKey,
          'Content-Type':
            'application/json'
        },
        body:
          JSON.stringify(body)
      }
    )
  } catch (error) {
    console.error(
      'manage-user isteği gönderilemedi:',
      error
    )

    throw new Error(
      'Kullanıcı yönetimi servisine ulaşılamadı.'
    )
  }

  const responseText =
    await response.text()

  let result = null

  if (responseText) {
    try {
      result =
        JSON.parse(
          responseText
        )
    } catch {
      result = null
    }
  }

  if (!response.ok) {
    console.error(
      'manage-user HTTP hatası:',
      {
        status:
          response.status,
        statusText:
          response.statusText,
        body:
          responseText
      }
    )

    throw new Error(
      result?.error ||
      result?.message ||
      responseText ||
      `Kullanıcı yönetimi işlemi başarısız oldu (HTTP ${response.status}).`
    )
  }

  if (!result?.success) {
    console.error(
      'manage-user beklenmeyen başarılı HTTP yanıtı:',
      {
        status:
          response.status,
        body:
          responseText
      }
    )

    throw new Error(
      result?.error ||
      result?.message ||
      responseText ||
      `Sunucu beklenmeyen bir yanıt döndürdü (HTTP ${response.status}).`
    )
  }

  return result
}

export async function getManagedUsers() {
  const [
    profileResult,
    roleResult
  ] = await Promise.all([
    supabase
      .from('profiles')
      .select(`
        id,
        email,
        full_name,
        created_at,
        updated_at
      `),

    supabase
      .from('user_roles')
      .select(`
        user_id,
        role,
        created_at,
        updated_at
      `)
  ])

  if (profileResult.error) {
    throw new Error(
      `Kullanıcı profilleri alınamadı: ${profileResult.error.message}`
    )
  }

  if (roleResult.error) {
    throw new Error(
      `Kullanıcı rolleri alınamadı: ${roleResult.error.message}`
    )
  }

  const profiles = new Map(
    (profileResult.data || [])
      .map(mapProfile)
      .map((profile) => [
        profile.id,
        profile
      ])
  )

  return (roleResult.data || [])
    .map(mapRole)
    .map((roleRow) => {
      const profile =
        profiles.get(
          roleRow.userId
        )

      return {
        id:
          roleRow.userId,
        email:
          profile?.email || '',
        fullName:
          profile?.fullName || '',
        role:
          roleRow.role,
        createdAt:
          roleRow.createdAt ||
          profile?.createdAt ||
          null,
        updatedAt:
          roleRow.updatedAt ||
          profile?.updatedAt ||
          null
      }
    })
    .sort((a, b) => {
      const aTime =
        new Date(
          a.createdAt || 0
        ).getTime()

      const bTime =
        new Date(
          b.createdAt || 0
        ).getTime()

      return bTime - aTime
    })
}

export async function createPanelUser({
  fullName,
  email,
  password,
  role = 'staff'
}) {
  return invokeManageUser({
    action: 'create_user',
    fullName:
      normalizeText(fullName),
    email:
      normalizeEmail(email),
    password:
      String(
        password ?? ''
      ),
    role
  })
}

export async function resetPanelUserPassword(
  userId,
  password
) {
  return invokeManageUser({
    action:
      'reset_password',
    userId,
    password:
      String(
        password ?? ''
      )
  })
}

export async function setPanelUserRole(
  userId,
  role
) {
  const cleanUserId =
    normalizeText(userId)

  const cleanRole =
    normalizeText(role)

  if (!cleanUserId) {
    throw new Error(
      'Kullanıcı kimliği bulunamadı.'
    )
  }

  if (
    cleanRole !== 'admin' &&
    cleanRole !== 'staff'
  ) {
    throw new Error(
      'Geçersiz kullanıcı rolü.'
    )
  }

  const {
    data,
    error
  } =
    await supabase.rpc(
      'set_panel_user_role_safely',
      {
        p_user_id:
          cleanUserId,
        p_role:
          cleanRole
      }
    )

  if (error) {
    throw new Error(
      error.message ||
        'Kullanıcı rolü güncellenemedi.'
    )
  }

  return {
    success: true,
    message:
      cleanRole === 'admin'
        ? 'Kullanıcı admin yapıldı.'
        : 'Kullanıcı personel yapıldı.',
    result:
      data?.[0] || null
  }
}


export async function deletePanelUser(
  userId
) {
  const cleanUserId =
    normalizeText(userId)

  if (!cleanUserId) {
    throw new Error(
      'Kullanıcı kimliği bulunamadı.'
    )
  }

  return invokeManageUser({
    action: 'delete_user',
    userId: cleanUserId
  })
}