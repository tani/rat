#include <stdio.h>
#include <stdlib.h>

/*
 * bun:ffi cc() compiles one translation unit.
 * Include the libtexprintf sources directly so texstring/texfree are linked.
 */
#define Combining UnicodeBlocksCombining
#include "src/stringutils.c"
#undef Combining
#include "src/error.c"
#include "src/boxes.c"
#include "src/drawbox.c"
#include "src/lexer.c"
#include "src/parser.c"
#include "src/texprintf.c"

char *mdd_texstring(const char *input)
{
	return texstring(input);
}

void mdd_texfree(void *ptr)
{
	texfree(ptr);
}
