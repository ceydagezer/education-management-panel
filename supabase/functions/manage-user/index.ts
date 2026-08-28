import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

function jsonResponse(
  body: Record<string, unknown>,
  status = 200
) {
  return new Response(
    JSON.stringify(body),
    {
      status,
      headers: {
        ...corsHeaders,
        'Content-Type':
          'application/json; charset=utf-8'
      }
    }
  )
}

function cleanText(
  value: unknown
) {
  return String(
    value ?? ''
  ).trim()
}

function cleanEmail(
  value: unknown
) {
  return cleanText(
    value
  ).toLowerCase()
}

function validatePassword(
  password: string
) {
  if (password.length < 10) {
    return 'Şifre en az 10 karakter olmalıdır.'
  }

  if (
    !/[a-z]/.test(password) ||
    !/[A-Z]/.test(password) ||
    !/[0-9]/.test(password)
  ) {
    return 'Şifre en az bir büyük harf, bir küçük harf ve bir rakam içermelidir.'
  }

  return ''
}

function getServerAdminKey() {
  const secretKeysJson =
    Deno.env.get(
      'SUPABASE_SECRET_KEYS'
    )

  if (secretKeysJson) {
    try {
      const secretKeys =
        JSON.parse(
          secretKeysJson
        )

      const defaultSecretKey =
        String(
          secretKeys?.default || ''
        ).trim()

      if (defaultSecretKey) {
        return defaultSecretKey
      }
    } catch (error) {
      console.error(
        'SUPABASE_SECRET_KEYS okunamadı:',
        error
      )
    }
  }

  /*
   * Mevcut projelerde legacy service_role hâlâ bulunabilir.
   * Yeni secret key yoksa geriye dönük uyumluluk için fallback.
   */
  return String(
    Deno.env.get(
      'SUPABASE_SERVICE_ROLE_KEY'
    ) || ''
  ).trim()
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(
      'ok',
      {
        headers: corsHeaders
      }
    )
  }

  if (req.method !== 'POST') {
    return jsonResponse(
      {
        error:
          'Bu endpoint yalnızca POST isteği kabul eder.'
      },
      405
    )
  }

  const supabaseUrl =
    String(
      Deno.env.get(
        'SUPABASE_URL'
      ) || ''
    ).trim()

  const serverAdminKey =
    getServerAdminKey()

  const authorization =
    req.headers.get(
      'Authorization'
    ) || ''

  const apiKey =
    req.headers.get(
      'apikey'
    ) || ''

  if (
    !supabaseUrl ||
    !serverAdminKey
  ) {
    console.error(
      'Supabase Edge Function server yapılandırması eksik.'
    )

    return jsonResponse(
      {
        error:
          'Sunucu yapılandırması eksik.'
      },
      500
    )
  }

  if (
    !authorization.startsWith(
      'Bearer '
    ) ||
    !apiKey
  ) {
    return jsonResponse(
      {
        error:
          'Oturum doğrulanamadı.'
      },
      401
    )
  }

  /*
   * Kullanıcının JWT'sini burada auth.getUser() ile yeniden
   * doğrulamak yerine aynı Authorization + apikey ile PostgREST'e
   * gideriz. get_panel_admin_context() içindeki auth.uid() JWT
   * bağlamından gerçek kullanıcıyı belirler.
   *
   * Bu yol, uygulamada çalışan authenticated RPC mekanizmasıyla
   * aynıdır ve browser'dan gönderilen userId/role değerine güvenmez.
   */
  const callerClient =
    createClient(
      supabaseUrl,
      apiKey,
      {
        global: {
          headers: {
            Authorization:
              authorization
          }
        },
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

  const {
    data: adminContextRows,
    error: adminContextError
  } =
    await callerClient.rpc(
      'get_panel_admin_context'
    )

  if (adminContextError) {
    console.error(
      'Admin oturum bağlamı doğrulanamadı:',
      adminContextError
    )

    return jsonResponse(
      {
        error:
          'Oturum doğrulanamadı.'
      },
      401
    )
  }

  const adminContext =
    adminContextRows?.[0] ||
    null

  if (
    !adminContext?.user_id
  ) {
    return jsonResponse(
      {
        error:
          'Oturum doğrulanamadı.'
      },
      401
    )
  }

  if (
    adminContext.is_admin !==
    true
  ) {
    return jsonResponse(
      {
        error:
          'Bu işlem için admin yetkisi gereklidir.'
      },
      403
    )
  }

  const currentUserId =
    String(
      adminContext.user_id
    )

  /*
   * Yalnızca bu noktadan sonra yüksek yetkili server client
   * oluşturulur ve Auth Admin API işlemleri yapılır.
   */
  const adminClient =
    createClient(
      supabaseUrl,
      serverAdminKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

  let body: Record<
    string,
    unknown
  >

  try {
    body = await req.json()
  } catch {
    return jsonResponse(
      {
        error:
          'Geçersiz istek gövdesi.'
      },
      400
    )
  }

  const action =
    cleanText(
      body.action
    )

  if (
    action === 'create_user'
  ) {
    const email =
      cleanEmail(
        body.email
      )

    const fullName =
      cleanText(
        body.fullName
      )

    const password =
      String(
        body.password ?? ''
      )

    const role =
      cleanText(
        body.role
      ) || 'staff'

    if (!fullName) {
      return jsonResponse(
        {
          error:
            'Ad soyad zorunludur.'
        },
        400
      )
    }

    if (
      fullName.length > 120
    ) {
      return jsonResponse(
        {
          error:
            'Ad soyad 120 karakterden uzun olamaz.'
        },
        400
      )
    }

    const emailPattern =
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/

    if (
      !email ||
      !emailPattern.test(
        email
      )
    ) {
      return jsonResponse(
        {
          error:
            'Geçerli bir e-posta adresi giriniz.'
        },
        400
      )
    }

    if (
      role !== 'staff' &&
      role !== 'admin'
    ) {
      return jsonResponse(
        {
          error:
            'Geçersiz kullanıcı rolü.'
        },
        400
      )
    }

    const passwordError =
      validatePassword(
        password
      )

    if (passwordError) {
      return jsonResponse(
        {
          error:
            passwordError
        },
        400
      )
    }

    const {
      data: createdData,
      error: createError
    } =
      await adminClient
        .auth
        .admin
        .createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: {
            full_name:
              fullName
          }
        })

    if (
      createError ||
      !createdData?.user
    ) {
      console.error(
        'Kullanıcı oluşturulamadı:',
        createError
      )

      const createMessage =
        String(
          createError?.message ||
          ''
        ).toLocaleLowerCase(
          'tr-TR'
        )

      if (
        createMessage.includes(
          'already'
        ) ||
        createMessage.includes(
          'registered'
        ) ||
        createMessage.includes(
          'exists'
        )
      ) {
        return jsonResponse(
          {
            error:
              'Bu e-posta adresiyle zaten bir kullanıcı bulunmaktadır.'
          },
          409
        )
      }

      return jsonResponse(
        {
          error:
            'Kullanıcı oluşturulamadı.'
        },
        500
      )
    }

    const createdUserId =
      createdData.user.id

    if (
      role === 'admin'
    ) {
      const {
        error: promoteError
      } =
        await adminClient
          .from('user_roles')
          .update({
            role: 'admin'
          })
          .eq(
            'user_id',
            createdUserId
          )

      if (promoteError) {
        console.error(
          'Yeni kullanıcının admin rolü ayarlanamadı:',
          promoteError
        )

        const {
          error: rollbackError
        } =
          await adminClient
            .auth
            .admin
            .deleteUser(
              createdUserId
            )

        if (rollbackError) {
          console.error(
            'Kullanıcı oluşturma rollback işlemi başarısız:',
            rollbackError
          )
        }

        return jsonResponse(
          {
            error:
              'Kullanıcı rolü oluşturulamadığı için işlem geri alındı.'
          },
          500
        )
      }
    }

    return jsonResponse(
      {
        success: true,
        message:
          'Kullanıcı başarıyla oluşturuldu.',
        user: {
          id:
            createdUserId,
          email:
            createdData.user.email,
          role
        }
      },
      201
    )
  }

  if (
    action ===
    'reset_password'
  ) {
    const userId =
      cleanText(
        body.userId
      )

    const password =
      String(
        body.password ?? ''
      )

    if (!userId) {
      return jsonResponse(
        {
          error:
            'Kullanıcı kimliği bulunamadı.'
        },
        400
      )
    }

    const passwordError =
      validatePassword(
        password
      )

    if (passwordError) {
      return jsonResponse(
        {
          error:
            passwordError
        },
        400
      )
    }

    const {
      error: passwordUpdateError
    } =
      await adminClient
        .auth
        .admin
        .updateUserById(
          userId,
          {
            password
          }
        )

    if (
      passwordUpdateError
    ) {
      console.error(
        'Kullanıcı şifresi güncellenemedi:',
        passwordUpdateError
      )

      return jsonResponse(
        {
          error:
            'Yeni şifre kaydedilemedi.'
        },
        500
      )
    }

    return jsonResponse({
      success: true,
      message:
        'Kullanıcının şifresi yenilendi.'
    })
  }

  if (
    action === 'delete_user'
  ) {
    const userId =
      cleanText(
        body.userId
      )

    if (!userId) {
      return jsonResponse(
        {
          error:
            'Kullanıcı kimliği bulunamadı.'
        },
        400
      )
    }

    if (
      userId ===
      currentUserId
    ) {
      return jsonResponse(
        {
          error:
            'Kendi kullanıcı hesabınızı silemezsiniz.'
        },
        409
      )
    }

    const {
      data: targetRole,
      error: targetRoleError
    } =
      await adminClient
        .from('user_roles')
        .select('role')
        .eq(
          'user_id',
          userId
        )
        .maybeSingle()

    if (
      targetRoleError ||
      !targetRole
    ) {
      console.error(
        'Silinecek kullanıcının rolü alınamadı:',
        targetRoleError
      )

      return jsonResponse(
        {
          error:
            'Kullanıcı bulunamadı.'
        },
        404
      )
    }

    /*
     * Admin hesap doğrudan silinmez.
     * Önce Personel yapılır; ardından silinebilir.
     */
    if (
      targetRole.role ===
      'admin'
    ) {
      return jsonResponse(
        {
          error:
            'Admin kullanıcı doğrudan silinemez. Önce Personel Yap işlemini kullanınız.'
        },
        409
      )
    }

    const {
      error: deleteAuthError
    } =
      await adminClient
        .auth
        .admin
        .deleteUser(
          userId,
          false
        )

    if (
      deleteAuthError
    ) {
      console.error(
        'Auth kullanıcısı silinemedi:',
        deleteAuthError
      )

      return jsonResponse(
        {
          error:
            'Kullanıcı hesabı silinemedi.'
        },
        500
      )
    }

    const [
      roleCleanup,
      profileCleanup
    ] =
      await Promise.all([
        adminClient
          .from('user_roles')
          .delete()
          .eq(
            'user_id',
            userId
          ),
        adminClient
          .from('profiles')
          .delete()
          .eq(
            'id',
            userId
          )
      ])

    if (
      roleCleanup.error
    ) {
      console.error(
        'Silinen kullanıcının rol kaydı temizlenemedi:',
        roleCleanup.error
      )
    }

    if (
      profileCleanup.error
    ) {
      console.error(
        'Silinen kullanıcının profil kaydı temizlenemedi:',
        profileCleanup.error
      )
    }

    return jsonResponse({
      success: true,
      message:
        'Kullanıcı sistemden silindi.'
    })
  }

  /*
   * Rol değiştirme artık güvenli PostgreSQL RPC üzerinden
   * yapılıyor. Eski istemci çağrıları için burada da tutuyoruz.
   */
  if (
    action === 'set_role'
  ) {
    const userId =
      cleanText(
        body.userId
      )

    const role =
      cleanText(
        body.role
      )

    const {
      data,
      error
    } =
      await callerClient.rpc(
        'set_panel_user_role_safely',
        {
          p_user_id:
            userId,
          p_role:
            role
        }
      )

    if (error) {
      return jsonResponse(
        {
          error:
            error.message ||
            'Kullanıcı rolü güncellenemedi.'
        },
        400
      )
    }

    return jsonResponse({
      success: true,
      message:
        role === 'admin'
          ? 'Kullanıcı admin yapıldı.'
          : 'Kullanıcı personel yapıldı.',
      result:
        data?.[0] || null
    })
  }

  return jsonResponse(
    {
      error:
        'Geçersiz işlem.'
    },
    400
  )
})