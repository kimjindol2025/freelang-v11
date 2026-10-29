#define _POSIX_C_SOURCE 200809L
#include <errno.h>
#include <fcntl.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/wait.h>
#include <time.h>
#include <unistd.h>
#include <signal.h>

static uint32_t state=0x937a51e1u;
static const unsigned timeout_ms=3000;
static uint32_t rnd(void){state^=state<<13;state^=state>>17;state^=state<<5;return state;}
static long long ms(void){struct timespec t;clock_gettime(CLOCK_MONOTONIC,&t);return (long long)t.tv_sec*1000+t.tv_nsec/1000000;}

int main(int argc,char **argv){
    if(argc!=4)return 2;
    const char *compiler=argv[1],*src=argv[2]; unsigned count=(unsigned)strtoul(argv[3],NULL,10),issues=0,timeouts=0,crashes=0;
    if(!count)return 2;
    int fd=open(src,O_WRONLY|O_CREAT|O_TRUNC,0600);if(fd<0)return 2;
    static const char chars[]="abcXYZ0123[]{}&?:\0\xffλ";
    char input[65536];
    for(unsigned i=0;i<count;i++){
        size_t depth=(i%1000==0)?10000:((i%4==0)?1+(rnd()%24):0),n=0;
        while(depth--)input[n++]='(';
        input[n++]='('; input[n++]='d'; input[n++]='e'; input[n++]='f'; input[n++]='n'; input[n++]=' ';
        size_t extra=rnd()%64;
        for(size_t j=0;j<extra && n+1<sizeof(input);j++)input[n++]=chars[rnd()%(sizeof(chars)-1)];
        input[n]=0;
        if(ftruncate(fd,0)||lseek(fd,0,SEEK_SET)<0||write(fd,input,n)!=(ssize_t)n){close(fd);return 2;}
        pid_t pid=fork();if(pid<0){issues++;continue;}
        if(pid==0){int null=open("/dev/null",O_WRONLY);if(null>=0){dup2(null,1);dup2(null,2);close(null);}execl(compiler,compiler,src,"/dev/null",(char *)NULL);_exit(127);}
        long long deadline=ms()+timeout_ms;int status=0,done=0;
        while(ms()<deadline){pid_t w=waitpid(pid,&status,WNOHANG);if(w==pid){done=1;break;}if(w<0&&errno!=EINTR)break;struct timespec pause={0,1000000};nanosleep(&pause,NULL);}
        int issue = 0;
        if(!done){kill(pid,SIGKILL);waitpid(pid,&status,0);timeouts++;issue=1;}
        else if(WIFSIGNALED(status)){crashes++;issue=1;}
        else if(!WIFEXITED(status)||WEXITSTATUS(status)==0)issue=1;
        if(issue){
            issues++;
            if(issues==1){FILE *f=fopen("tests/fuzz-crashers/compiler-first.fl","wb");if(f){fwrite(input,1,n,f);fclose(f);}}
        }
    }
    close(fd);
    printf("COMPILER_FUZZ iterations=%u issues=%u timeouts=%u crashes=%u seed=0x937a51e1 timeout_ms=%u\n",count,issues,timeouts,crashes,timeout_ms);
    return issues!=0;
}
