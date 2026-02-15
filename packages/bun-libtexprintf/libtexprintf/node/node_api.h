#ifndef NODE_NODE_API_H_
#define NODE_NODE_API_H_

#include <stddef.h>
#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

typedef struct napi_env__ *napi_env;
typedef struct napi_value__ *napi_value;

typedef enum
{
	napi_ok = 0
} napi_status;

#define NAPI_AUTO_LENGTH ((size_t)-1)

napi_status napi_create_string_utf8(
	napi_env env,
	const char *str,
	size_t length,
	napi_value *result);

napi_status napi_get_value_string_utf8(
	napi_env env,
	napi_value value,
	char *buf,
	size_t bufsize,
	size_t *result);

napi_status napi_get_undefined(napi_env env, napi_value *result);

#ifdef __cplusplus
}
#endif

#endif
