# コンパイラを指定
CC :=g++
# インクルードファイル等
CFLAGS :=`pkg-config opencv --cflags` `pkg-config opencv --libs`
LDFLAGS :=
LIB := -L . libraspicamcv.a -llazurite -L ~/git/raspberrypi/userland/build/lib -lmmal_core -lmmal -lmmal_util -lvcos -lbcm_host
# ディレクトリ内の全てのC++ファイルをコンパイル
SOURCES :=$(wildcard *.cpp)
# C++ファイルの.cppをとったものを実行ファイルの名前とする
EXECUTABLE :=$(SOURCES:.cpp=)

#all:$(EXECUTABLE)

#$(EXECUTABLE):$(SOURCES)
#	$(CC) $(SOURCES) $(LDFLAGS) $(CFLAGS) -o $(EXECUTABLE) $(LIB)


all: 
	$(CC) -I./libpatlamp -L./libpatlamp test.cpp -o test -lpatlamp 

clean:
	    rm -rf $(EXECUTABLE)
